"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { TodoItem } from "@/shared/types/todoItem";
import { useTodoState } from "../providers/todoStateProvider";
import { cn } from "@/lib/utils";

interface TodoListItemProps {
    todo: TodoItem;
}

const TodoListItem = ({ todo }: TodoListItemProps) => {
    const { toggleTodo, removeTodo } = useTodoState();

    return (
        <li className="group flex flex-row items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent">
            <Checkbox
                id={todo.id}
                checked={todo.done}
                onCheckedChange={() => toggleTodo(todo.id)}
            />
            <label
                htmlFor={todo.id}
                className={cn(
                    "flex-1 cursor-pointer text-sm break-words",
                    todo.done && "text-muted-foreground line-through"
                )}
            >
                {todo.title}
            </label>
            <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${todo.title}`}
                className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => removeTodo(todo.id)}
            >
                <XIcon className="size-3.5" />
            </Button>
        </li>
    );
};

export default TodoListItem;
