/**
 * LISTA DOBLEMENTE ENLAZADA — Hipstagram Feed Buffer
 *
 * Estructura de datos utilizada como buffer en memoria para el feed de publicaciones.
 * Cada nodo mantiene referencia al anterior y al siguiente, permitiendo
 * inserción y eliminación eficiente en cualquier posición sin reorganizar memoria.
 *
 *   null ← [prev|data|next] ⇄ [prev|data|next] ⇄ [prev|data|next] → null
 *            ↑ head                                       ↑ tail
 */

export class ListNode<T> {
  data: T;
  prev: ListNode<T> | null = null;
  next: ListNode<T> | null = null;

  constructor(data: T) {
    this.data = data;
  }
}

export class DoublyLinkedList<T> {
  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;
  size: number = 0;

  /** Verifica si la lista está vacía */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /** Inserta un elemento al final de la lista — O(1) */
  insertAtEnd(data: T): ListNode<T> {
    const node = new ListNode(data);
    if (!this.tail) {
      this.head = node;
      this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
    return node;
  }

  /** Inserta un elemento al inicio de la lista — O(1)
   *  Útil para agregar publicaciones nuevas al tope del feed */
  insertAtHead(data: T): ListNode<T> {
    const node = new ListNode(data);
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    this.size++;
    return node;
  }

  /** Elimina un nodo específico de la lista — O(1) */
  remove(node: ListNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = null;
    this.size--;
  }

  /** Busca el primer nodo que cumple la condición — O(n) */
  find(predicate: (data: T) => boolean): ListNode<T> | null {
    let current = this.head;
    while (current) {
      if (predicate(current.data)) return current;
      current = current.next;
    }
    return null;
  }

  /** Convierte la lista a un array para serializar en la respuesta JSON — O(n) */
  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.data);
      current = current.next;
    }
    return result;
  }

  /** Carga un array en la lista insertando cada elemento al final — O(n) */
  fromArray(items: T[]): this {
    items.forEach(item => this.insertAtEnd(item));
    return this;
  }
}
