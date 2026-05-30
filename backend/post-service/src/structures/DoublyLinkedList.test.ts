import { DoublyLinkedList, ListNode } from './DoublyLinkedList';

describe('DoublyLinkedList', () => {
  let list: DoublyLinkedList<number>;

  beforeEach(() => {
    list = new DoublyLinkedList<number>();
  });

  // ── Estado inicial ────────────────────────────────────────────────────
  it('inicia vacía con size 0', () => {
    expect(list.isEmpty()).toBe(true);
    expect(list.size).toBe(0);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
  });

  // ── insertAtEnd ───────────────────────────────────────────────────────
  it('insertAtEnd agrega el primer elemento como head y tail', () => {
    list.insertAtEnd(1);
    expect(list.head?.data).toBe(1);
    expect(list.tail?.data).toBe(1);
    expect(list.size).toBe(1);
  });

  it('insertAtEnd encadena correctamente prev y next', () => {
    list.insertAtEnd(1);
    list.insertAtEnd(2);
    list.insertAtEnd(3);
    expect(list.head?.data).toBe(1);
    expect(list.tail?.data).toBe(3);
    expect(list.head?.next?.data).toBe(2);
    expect(list.tail?.prev?.data).toBe(2);
    expect(list.size).toBe(3);
  });

  // ── insertAtHead ──────────────────────────────────────────────────────
  it('insertAtHead en lista vacía establece head y tail', () => {
    list.insertAtHead(1);
    expect(list.head?.data).toBe(1);
    expect(list.tail?.data).toBe(1);
    expect(list.size).toBe(1);
  });

  it('insertAtHead agrega al inicio correctamente', () => {
    list.insertAtEnd(2);
    list.insertAtEnd(3);
    list.insertAtHead(1);
    expect(list.head?.data).toBe(1);
    expect(list.head?.next?.data).toBe(2);
    expect(list.size).toBe(3);
  });

  // ── remove ────────────────────────────────────────────────────────────
  it('remove elimina el único elemento dejando la lista vacía', () => {
    const node = list.insertAtEnd(1);
    list.remove(node);
    expect(list.isEmpty()).toBe(true);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
  });

  it('remove elimina el head y actualiza el puntero', () => {
    const n1 = list.insertAtEnd(1);
    list.insertAtEnd(2);
    list.remove(n1);
    expect(list.head?.data).toBe(2);
    expect(list.head?.prev).toBeNull();
    expect(list.size).toBe(1);
  });

  it('remove elimina el tail y actualiza el puntero', () => {
    list.insertAtEnd(1);
    const n2 = list.insertAtEnd(2);
    list.remove(n2);
    expect(list.tail?.data).toBe(1);
    expect(list.tail?.next).toBeNull();
    expect(list.size).toBe(1);
  });

  it('remove elimina un nodo del medio correctamente', () => {
    list.insertAtEnd(1);
    const n2 = list.insertAtEnd(2);
    list.insertAtEnd(3);
    list.remove(n2);
    expect(list.head?.next?.data).toBe(3);
    expect(list.tail?.prev?.data).toBe(1);
    expect(list.size).toBe(2);
  });

  // ── find ──────────────────────────────────────────────────────────────
  it('find devuelve el nodo correcto', () => {
    list.insertAtEnd(10);
    list.insertAtEnd(20);
    list.insertAtEnd(30);
    const found = list.find(d => d === 20);
    expect(found?.data).toBe(20);
  });

  it('find devuelve null si no existe', () => {
    list.insertAtEnd(1);
    expect(list.find(d => d === 99)).toBeNull();
  });

  // ── toArray / fromArray ───────────────────────────────────────────────
  it('toArray devuelve los elementos en orden', () => {
    list.insertAtEnd(1);
    list.insertAtEnd(2);
    list.insertAtEnd(3);
    expect(list.toArray()).toEqual([1, 2, 3]);
  });

  it('fromArray carga todos los elementos en orden', () => {
    list.fromArray([10, 20, 30]);
    expect(list.toArray()).toEqual([10, 20, 30]);
    expect(list.size).toBe(3);
  });

  it('toArray devuelve array vacío en lista vacía', () => {
    expect(list.toArray()).toEqual([]);
  });

  // ── Uso real: buffer del feed ─────────────────────────────────────────
  it('simula el buffer del feed: carga posts y los devuelve en orden de likes', () => {
    const posts = [
      { id: '1', descripcion: 'Post popular', likes: 100 },
      { id: '2', descripcion: 'Post normal',  likes: 50  },
      { id: '3', descripcion: 'Post nuevo',   likes: 10  },
    ];
    const feedList = new DoublyLinkedList<typeof posts[0]>().fromArray(posts);
    const resultado = feedList.toArray();
    expect(resultado).toHaveLength(3);
    expect(resultado[0].likes).toBe(100);
    expect(resultado[1].likes).toBe(50);
  });
});
