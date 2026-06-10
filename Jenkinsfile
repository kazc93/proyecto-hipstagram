pipeline {
    agent any

    tools {
        nodejs 'Node20'
    }

    environment {
        AWS_ACCOUNT_ID = '630171690893'
        AWS_REGION     = 'us-east-1'
        ECR_REGISTRY   = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    }

    stages {

        // ─────────────────────────────────────────
        stage('1. Obtener Código') {
            steps {
                checkout scm
            }
        }

        // ─────────────────────────────────────────
        stage('2. Instalar Dependencias') {
            steps {
                dir('backend/auth-service')         { sh 'npm install' }
                dir('backend/post-service')         { sh 'npm install' }
                dir('backend/audit-service')        { sh 'npm install' }
                dir('backend/interactions-service') { sh 'npm install' }
                dir('backend/search-service')       { sh 'npm install' }
                dir('backend/user-service')         { sh 'npm install' }
                dir('backend/media-service')        { sh 'npm install' }
                dir('backend/moderation-service')   { sh 'npm install' }
                dir('backend/api-gateway')          { sh 'npm install' }
            }
        }

        // ─────────────────────────────────────────
        stage('3. Lint y Seguridad de Dependencias') {
            steps {
                dir('backend/auth-service')         { sh 'npm audit --audit-level=high || true' }
                dir('backend/post-service')         { sh 'npm audit --audit-level=high || true' }
                dir('backend/audit-service')        { sh 'npm audit --audit-level=high || true' }
                dir('backend/interactions-service') { sh 'npm audit --audit-level=high || true' }
                dir('backend/search-service')       { sh 'npm audit --audit-level=high || true' }
                dir('backend/user-service')         { sh 'npm audit --audit-level=high || true' }
                dir('backend/moderation-service')   { sh 'npm audit --audit-level=high || true' }
                dir('backend/api-gateway')          { sh 'npm audit --audit-level=high || true' }
            }
        }

        // ─────────────────────────────────────────
        stage('4. Pruebas Unitarias y Cobertura') {
            steps {
                dir('backend/auth-service')         { sh 'npm run test:cov' }
                dir('backend/post-service')         { sh 'npm run test:cov' }
                dir('backend/interactions-service') { sh 'npm run test:cov' }
            }
        }

        // ─────────────────────────────────────────
        stage('5. Análisis SonarQube') {
            environment {
                scannerHome = tool 'SonarQubeScanner'
            }
            steps {
                sh 'find backend -maxdepth 2 -name node_modules -type d | xargs rm -rf'
                sh 'mv frontend/tsconfig.json frontend/tsconfig.json.bak'
                withSonarQubeEnv('SonarQube-Server') {
                    sh "${scannerHome}/bin/sonar-scanner"
                }
            }
            post {
                always {
                    sh 'mv frontend/tsconfig.json.bak frontend/tsconfig.json 2>/dev/null || true'
                }
            }
        }

        // ─────────────────────────────────────────
        stage('6. Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ─────────────────────────────────────────
        stage('7. Build & Push a ECR') {
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'aws-credentials',
                    accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                    secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                ]]) {
                    script {
                        sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"

                        def services = [
                            [dir: 'backend/auth-service',         repo: 'hipstagram-auth-service'],
                            [dir: 'backend/post-service',         repo: 'hipstagram-post-service'],
                            [dir: 'backend/audit-service',        repo: 'hipstagram-audit-service'],
                            [dir: 'backend/interactions-service', repo: 'hipstagram-interactions-service'],
                            [dir: 'backend/search-service',       repo: 'hipstagram-search-service'],
                            [dir: 'backend/user-service',         repo: 'hipstagram-user-service'],
                            [dir: 'backend/media-service',        repo: 'hipstagram-media-service'],
                            [dir: 'backend/moderation-service',   repo: 'hipstagram-moderation-service'],
                            [dir: 'backend/api-gateway',          repo: 'hipstagram-gateway']
                        ]

                        services.each { svc ->
                            def imageTag = "${ECR_REGISTRY}/${svc.repo}:latest"
                            sh "docker build -t ${imageTag} ${svc.dir}"
                            sh "docker push ${imageTag}"
                        }
                    }
                }
            }
        }

        // ─────────────────────────────────────────
        stage('8. Deploy en EC2') {
            steps {
                withCredentials([
                    [$class: 'AmazonWebServicesCredentialsBinding',
                     credentialsId: 'aws-credentials',
                     accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                     secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'],
                    string(credentialsId: 'DB_PASSWORD_PROD', variable: 'DB_PASS')
                ]) {
                    script {
                        sh """
                            # Login a ECR para poder hacer pull
                            aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

                            # Generar .env.prod con credenciales de producción (nunca se versiona)
                            printf 'DB_HOST=hipstagram-db.cs9sacam0rnd.us-east-1.rds.amazonaws.com\\n' > .env.prod
                            printf 'DB_NAME=hipstagram_db\\n'         >> .env.prod
                            printf 'DB_USER=hipstagram_admin\\n'      >> .env.prod
                            printf 'DB_PASSWORD=%s\\n' '${DB_PASS}'  >> .env.prod
                            printf 'JWT_SECRET=hipstagram_jwt_secret_2026\\n' >> .env.prod
                            printf 'JWT_REFRESH_SECRET=super_secret_refresh\\n' >> .env.prod
                            printf 'AUDIT_SERVICE_URL=http://audit-service:3003/log\\n' >> .env.prod

                            # Credenciales AWS para S3 (subida de imágenes) y Rekognition
                            printf 'AWS_ACCESS_KEY_ID=%s\\n' "\$AWS_ACCESS_KEY_ID"     >> .env.prod
                            printf 'AWS_SECRET_ACCESS_KEY=%s\\n' "\$AWS_SECRET_ACCESS_KEY" >> .env.prod
                            printf 'AWS_REGION=us-east-1\\n'                   >> .env.prod
                            printf 'AWS_BUCKET_NAME=hipstagram-images\\n'      >> .env.prod

                            # Crear .env vacíos por servicio (las vars reales vienen de .env.prod)
                            for dir in backend/auth-service backend/post-service backend/audit-service backend/interactions-service backend/search-service backend/user-service backend/media-service backend/moderation-service backend/api-gateway; do
                                touch \$dir/.env
                            done

                            # Detener contenedores previos (proyecto fijo 'hipstagram' para no chocar con workspaces @2)
                            docker compose -p hipstagram -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
                            # Eliminar contenedores huérfanos con nombre fijo por si quedaron de un deploy anterior
                            docker rm -f auth_service post_service audit_service interactions_service search_service user_service media_service moderation_service api_gateway 2>/dev/null || true

                            # Pull últimas imágenes y levantar
                            docker compose -p hipstagram -f docker-compose.prod.yml pull
                            docker compose -p hipstagram -f docker-compose.prod.yml up -d --remove-orphans

                            # Limpiar imágenes sin usar
                            docker image prune -f
                        """
                    }
                }
            }
        }

        // ─────────────────────────────────────────
        stage('9. Smoke Test') {
            steps {
                sh 'sleep 45'
                sh 'curl -f http://localhost:8080/health || (echo "❌ Gateway no responde" && exit 1)'
            }
        }
    }

    post {
        success {
            echo "Deploy exitoso → http://3.88.254.85:9090"
            mail to: 'upakevin93@gmail.com',
                 subject: "ÉXITO: Despliegue de Hipstagram #${env.BUILD_NUMBER}",
                 body: "¡Nítido! El pipeline terminó correctamente.\n\nEl nuevo código ya está corriendo en el servidor EC2\nPuedes ver los detalles del pipeline aquí:\nhttp://3.88.254.85:9090/job/hipstagram-pipeline/${env.BUILD_NUMBER}/console"
        }
        failure {
            echo "Pipeline falló. Revisa los logs de Jenkins."
            mail to: 'upakevin93@gmail.com', 
                 subject: "ERROR: Fallo en Hipstagram #${env.BUILD_NUMBER}",
                 body: "Hubo un problema durante la ejecución del pipeline.\n\nRevisa los logs de Jenkins inmediatamente para ver qué falló:\nhttp://3.88.254.85:9090/job/hipstagram-pipeline/${env.BUILD_NUMBER}/console"
        }
    }
}

