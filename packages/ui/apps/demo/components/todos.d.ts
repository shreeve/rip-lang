export declare class Todos {
  constructor(props?: Record<string, any>);
  newTodo: any;
  todos: any;
  nextId: any;
  readonly remaining: any;
  addTodo(): void;
  deleteTodo(): void;
  clearAll(): void;
  handleKey(): void;
  mount(target: Element | string): Todos;
  unmount(): void;
}
