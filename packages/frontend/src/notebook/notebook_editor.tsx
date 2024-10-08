import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { DocHandle, Prop } from "@automerge/automerge-repo";
import { type KbdKey, createShortcut } from "@solid-primitives/keyboard";
import ListPlus from "lucide-solid/icons/list-plus";
import {
    type Component,
    For,
    Match,
    Show,
    Switch,
    createEffect,
    createSignal,
    onCleanup,
} from "solid-js";

import { type Completion, IconButton } from "../components";
import { deepCopyJSON } from "../util/deepcopy";
import {
    type CellActions,
    type FormalCellEditorProps,
    NotebookCell,
    RichTextCellEditor,
    StemCellEditor,
    isCellDragData,
} from "./notebook_cell";
import { type Cell, CellId, type FormalCell, type Notebook, newRichTextCell, newStemCell } from "./types";

import "./notebook_editor.css";

/** Constructor of a cell in a notebook.

A notebook knows how to edit cells, but without cell constructors, it wouldn't
know how to create them!
 */
export type CellConstructor<T> = {
    // Name of cell constructor, usually naming the cell type.
    name: string;

    // Tooltip-length description of cell constructor.
    description?: string;

    // Keyboard shortcut to invoke the constructor.
    shortcut?: KbdKey[];

    // Function to construct the cell.
    construct: () => Cell<T>;
};

/** Notebook editor based on Automerge.

A notebook has two types of cells:

1. Rich text cells, with state managed by Automerge and ProseMirror
   independently of Solid's own state management
2. Formal content cells, with state inside a Solid Store connected to Automerge

Rich text cells are the same in all notebooks, whereas formal cells are handled
by custom components supplied to the notebook.
 */
export function NotebookEditor<T>(props: {
    handle: DocHandle<unknown>;
    path: Prop[];
    notebook: Notebook<T>;
    changeNotebook: (f: (nb: Notebook<T>) => void) => void;
    formalCellEditor: Component<FormalCellEditorProps<T>>;
    cellConstructors: CellConstructor<T>[];
    cellLabel?: (content: T) => string | undefined;
    // FIXME: Remove this option once we fix focus management.
    noShortcuts?: boolean;
}) {

    type CellsState = {
        activeCell: number;
        // A selection is determined by a set of cell ids, rather than a set of indices into `notebook.cells`.
        // This means that a selection remains valid even when cells are added or moved around.
        selectedCells: Set<CellId>;
    };

    const [cellsState, setCellsState] = createSignal<CellsState>({
        activeCell: props.notebook.cells.length > 0 ? 0 : -1,
        selectedCells: new Set(),
    });

    const activeCell = () => cellsState().activeCell;
    const selectedCells = () => cellsState().selectedCells;

    // When `activeCell` changes, `selectedCells` is cleared.
    const setActiveCell = (i: number) => {
        setCellsState((prev) => ({
            ...prev,
            activeCell: i,
            selectedCells: new Set()
        }));
    };
    // TODO determine how `activeCell` should be updated when the selection is updated.
    // For now, we don't update `activeCell` when the selection changes.
    const setSelectedCells = (update: Set<CellId> | ((prev: Set<CellId>) => Set<CellId>)) => {
        const s = typeof update === "function" ? update(selectedCells()) : update;
        setCellsState((prev) => ({
            ...prev,
            selectedCells: s
        }));

        if (s.size !== 0) {

            console.log("clearing text selection");
            // Clear text selection
            const selection = document.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
        }
    };

    // There is one use of semantically setting active cell that we are handling separately so as not to clear the selection.
    const setActiveCellViaFocus = (i: number) => {
        setCellsState((prev) => ({
            ...prev,
            activeCell: i,
        }));
    };

    const toggleCellSelection = (cellId: CellId) => {
        setSelectedCells((prev: Set<CellId>) => {
            const newSelection = new Set(prev);
            if (newSelection.has(cellId)) {
                newSelection.delete(cellId);
            } else {
                newSelection.add(cellId);
            }
            return newSelection;
        });
    };

    const handleCellContentClick = (index: number, cellId: CellId, event: MouseEvent) => {
        console.log("handleCellContentClick got called: ", index);
        if (event.ctrlKey) {
            toggleCellSelection(cellId);
            return
        }
    };

    const addAfterActiveCell = (cell: Cell<T>) => {
        props.changeNotebook((nb) => {
            nb.cells.splice(activeCell() + 1, 0, cell);
            setActiveCell(activeCell() + 1);
        });
    };

    const addOrReplaceActiveCell = (cell: Cell<T>) => {
        const c = props.notebook.cells[activeCell()];
        if (c) {
            if (c.tag === "formal" || c.tag === "rich-text") {
                addAfterActiveCell(cell);
            } else if (c.tag === "stem") {
                replaceCellWith(activeCell(), cell);
            }
        } else {
            addAfterActiveCell(cell);
        }
    };

    const appendCell = (cell: Cell<T>) => {
        props.changeNotebook((nb) => {
            nb.cells.push(cell);
            setActiveCell(nb.cells.length - 1);
        });
    };

    const insertCommands = (): Completion[] =>
        cellConstructors().map((cc) => {
            const { name, description, shortcut } = cc;
            return {
                name,
                description,
                shortcut,
                onComplete: () => addOrReplaceActiveCell(cc.construct()),
            };
        });

    const replaceCellWith = (i: number, cell: Cell<T>) => {
        props.changeNotebook((nb) => {
            nb.cells[i] = cell;
        });
    };

    const cellConstructors = (): CellConstructor<T>[] => [
        {
            name: "Text",
            description: "Start writing text",
            shortcut: [cellShortcutModifier, "T"],
            construct: () => newRichTextCell(),
        },
        ...props.cellConstructors,
    ];

    const replaceCommands = (i: number): Completion[] =>
        cellConstructors().map((cc) => {
            const { name, description, shortcut } = cc;
            return {
                name,
                description,
                shortcut,
                onComplete: () => replaceCellWith(i, cc.construct()),
            };
        });

    createEffect(() => {
        if (props.noShortcuts) {
            return;
        }
        for (const command of insertCommands()) {
            if (command.shortcut) {
                createShortcut(command.shortcut, () => command.onComplete?.());
            }
        }
        createShortcut(["Shift", "Enter"], () => addAfterActiveCell(newStemCell()));
    });

    // Set up drag and drop of notebook cells.
    createEffect(() => {
        const cleanup = monitorForElements({
            canMonitor({ source }) {
                return (
                    isCellDragData(source.data) &&
                    props.notebook.cells.some((cell) => cell.id === source.data.cellId)
                );
            },
            onDrop({ location, source }) {
                const target = location.current.dropTargets[0];
                if (!(target && isCellDragData(source.data) && isCellDragData(target.data))) {
                    return;
                }
                const [sourceId, targetId] = [source.data.cellId, target.data.cellId];
                const nb = props.notebook;
                const sourceIndex = nb.cells.findIndex((cell) => cell.id === sourceId);
                const targetIndex = nb.cells.findIndex((cell) => cell.id === targetId);
                if (sourceIndex < 0 || targetIndex < 0) {
                    return;
                }
                const finalIndex = getReorderDestinationIndex({
                    startIndex: sourceIndex,
                    indexOfTarget: targetIndex,
                    closestEdgeOfTarget: extractClosestEdge(target.data),
                    axis: "vertical",
                });
                props.changeNotebook((nb) => {
                    const [cell] = nb.cells.splice(sourceIndex, 1);
                    nb.cells.splice(finalIndex, 0, deepCopyJSON(cell));
                });
            },
        });
        onCleanup(cleanup);
    });

    // Hook into the web selection API
    createEffect(() => {
        const handleSelectionChange = () => {
            const selection = document.getSelection();
            if (selection) {
                console.log(`selectionchange ${selection.type}`);
            }
            if (selection && selection.type === "Range" && selectedCells().size > 0) {
                console.log("clear cells due to text selection");
                // Text is selected, clear cell selection
                setSelectedCells(new Set());
            }
        };

        document.addEventListener("selectionchange", handleSelectionChange);

        onCleanup(() => {
            document.removeEventListener("selectionchange", handleSelectionChange);
        });
    });

    return (
        <div class="notebook">
            <Show when={props.notebook.cells.length === 0}>
                <div class="notebook-empty placeholder">
                    <IconButton onClick={() => appendCell(newStemCell())}>
                        <ListPlus />
                    </IconButton>
                    <span>Click button or press Shift-Enter to create a cell</span>
                </div>
            </Show>
            <ul class="notebook-cells">
                <For each={props.notebook.cells}>
                    {(cell, i) => {
                        const isActive = () => activeCell() === i();
                        const isSelected = () => selectedCells().has(cell.id);
                        const cellActions: CellActions = {
                            activateAbove: () => {
                                i() > 0 && setActiveCell(i() - 1);
                            },
                            activateBelow: () => {
                                const n = props.notebook.cells.length;
                                i() < n - 1 && setActiveCell(i() + 1);
                            },
                            createAbove: () =>
                                props.changeNotebook((nb) => {
                                    nb.cells.splice(i(), 0, newStemCell());
                                    setActiveCell(i());
                                }),
                            createBelow: () =>
                                props.changeNotebook((nb) => {
                                    nb.cells.splice(i() + 1, 0, newStemCell());
                                    setActiveCell(i() + 1);
                                }),
                            deleteBackward: () =>
                                props.changeNotebook((nb) => {
                                    nb.cells.splice(i(), 1);
                                    setActiveCell(i() - 1);
                                }),
                            deleteForward: () =>
                                props.changeNotebook((nb) => {
                                    nb.cells.splice(i(), 1);
                                    setActiveCell(i());
                                }),
                            hasFocused: () => {
                                setActiveCellViaFocus(i());
                            },
                            select: () => {
                                setSelectedCells(new Set([cell.id]));
                            }
                        };

                        return (
                            <li>
                                <NotebookCell
                                    cellId={cell.id}
                                    actions={cellActions}
                                    tag={
                                        cell.tag === "formal"
                                            ? props.cellLabel?.(cell.content)
                                            : undefined
                                    }
                                    appearsSelected={isSelected()}
                                    onClickCellContent={(e: MouseEvent) => handleCellContentClick(i(), cell.id, e)}
                                >
                                    <Switch>
                                        <Match when={cell.tag === "rich-text"}>
                                            <RichTextCellEditor
                                                cellId={cell.id}
                                                handle={props.handle}
                                                path={[...props.path, "cells", i()]}
                                                isActive={isActive()}
                                                actions={cellActions}
                                            />
                                        </Match>
                                        <Match when={cell.tag === "formal"}>
                                            <props.formalCellEditor
                                                content={(cell as FormalCell<T>).content}
                                                changeContent={(f) => {
                                                    props.changeNotebook((nb) => {
                                                        f((nb.cells[i()] as FormalCell<T>).content);
                                                    });
                                                }}
                                                isActive={isActive()}
                                                actions={cellActions}
                                            />
                                        </Match>
                                        <Match when={cell.tag === "stem"}>
                                            <StemCellEditor
                                                completions={replaceCommands(i())}
                                                isActive={isActive()}
                                                actions={cellActions}
                                            />
                                        </Match>
                                    </Switch>
                                </NotebookCell>
                            </li>
                        );
                    }}
                </For>
            </ul>
            <Show when={props.notebook.cells.some((cell) => cell.tag !== "stem")}>
                <div class="placeholder">
                    <IconButton
                        onClick={() => appendCell(newStemCell())}
                        tooltip="Create a new cell"
                    >
                        <ListPlus />
                    </IconButton>
                </div>
            </Show>
        </div>
    );
}

/** Modifier key to use in keyboard shortcuts for cell constructors.

The choice is platform-specific: On Mac, the Alt/Option key remaps keys, so we
use Control, whereas on other platforms Control tends to be already bound in
other shortcuts, so we Alt.
 */
export const cellShortcutModifier: KbdKey = navigator.userAgent.includes("Mac") ? "Control" : "Alt";
