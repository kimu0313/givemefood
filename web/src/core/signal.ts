// Godot signal 같은 간단한 이벤트: connect 로 듣고 emit 으로 알린다.

export class Signal<A extends unknown[] = []> {
  private handlers: ((...args: A) => void)[] = [];

  connect(fn: (...args: A) => void): void {
    this.handlers.push(fn);
  }

  disconnectAll(): void {
    this.handlers = [];
  }

  emit(...args: A): void {
    for (const h of [...this.handlers]) h(...args);
  }
}
