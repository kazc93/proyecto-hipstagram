import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  userId: string | null = null;
  posts: any[] = [];
  loading = true;
  totalPosts = 0;

  private apiUrl = environment.apiUrl;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (this.userId) {
      this.loadUserPosts();
    }
  }

  loadUserPosts() {
    this.http.get(`${this.apiUrl}/posts/user/${this.userId}`).subscribe({
      next: (res: any) => {
        this.posts = res.data;
        this.totalPosts = res.total;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando el perfil en la UI:', err);
        this.loading = false;
      }
    });
  }
}

