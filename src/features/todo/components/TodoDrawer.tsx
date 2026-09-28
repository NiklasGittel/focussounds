"use client";

import { useState } from "react";
import { ListChecksIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { useTodoState } from "../providers/todoStateProvider";
import TodoListItem from "./TodoListItem";

const TodoDrawer = () => {
    const { todos, addTodo, clearCompleted } = useTodoState();
    const [draft, setDraft] = useState("");

    const openTodos = todos.filter((todo) => !todo.done).length;
    const completedTodos = todos.length - openTodos;

    const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        addTodo(draft);
        setDraft("");
    };

    return (
        <Drawer showSwipeHandle
            swipeDirection="right" modal={false} disablePointerDismissal >

            <DrawerTrigger
                render={
                    <Button variant="outline" size="icon" aria-label="Open to-do list">
                        <ListChecksIcon />
                    </Button>
                }
            />
            <DrawerContent className="mx-auto sm:max-w-md">
                <DrawerHeader>
                    <DrawerTitle>To-do</DrawerTitle>
                    <DrawerDescription>
                        {todos.length === 0
                            ? ""
                            :  openTodos === 0 ? "All done." :  `${openTodos} open, ${completedTodos} done.`}
                    </DrawerDescription>
                </DrawerHeader>

                <form onSubmit={onSubmit} className="flex flex-row gap-2 p-4 pb-2">
                    <Input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Add a task..."
                        aria-label="New task"
                    />
                    <Button type="submit" size="icon" variant="outline" aria-label="Add task">
                        <PlusIcon />
                    </Button>
                </form>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                    {todos.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            Nothing on the list yet.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-0.5">
                            {todos.map((todo) => (
                                <TodoListItem key={todo.id} todo={todo} />
                            ))}
                        </ul>
                    )}
                </div>

                <div className="shrink-0 p-4 pt-2">
                    <Button
                        variant="ghost"
                        className="w-full"
                        disabled={completedTodos === 0}
                        onClick={clearCompleted}
                    >
                        Clear completed
                    </Button>
                </div>
                <DrawerFooter>
                    <DrawerClose render={<Button variant="outline">Close</Button>} />
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
};

export default TodoDrawer;
