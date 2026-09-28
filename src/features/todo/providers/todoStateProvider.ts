import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { TodoItem } from "@/shared/types/todoItem";

interface TodoState {
    todos: TodoItem[];
    addTodo: (title: string) => void;
    toggleTodo: (id: string) => void;
    removeTodo: (id: string) => void;
    clearCompleted: () => void;
}

export const useTodoState = create<TodoState>()(
    devtools(
        persist(
            (set) => ({
                todos: [],
                addTodo: (title: string) => {
                    const trimmed = title.trim();
                    if (!trimmed) return;
                    set((state) => ({
                        todos: [
                            ...state.todos,
                            { id: crypto.randomUUID(), title: trimmed, done: false },
                        ],
                    }));
                },
                toggleTodo: (id: string) => {
                    set((state) => ({
                        todos: state.todos.map((todo) =>
                            todo.id === id ? { ...todo, done: !todo.done } : todo
                        ),
                    }));
                },
                removeTodo: (id: string) => {
                    set((state) => ({
                        todos: state.todos.filter((todo) => todo.id !== id),
                    }));
                },
                clearCompleted: () => {
                    set((state) => ({
                        todos: state.todos.filter((todo) => !todo.done),
                    }));
                },
            }),
            {
                name: 'todo-state-storage',
            },
        ),
    ),
)
