import { useState, useEffect, useRef } from "react";
import {
  FolderSimplePlusIcon,
  FunnelSimpleIcon,
  SquaresFourIcon,
  ListIcon,
  ArrowsClockwiseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";

import styles from "../css/notebookexplorer.module.css";

export default function NotebookExplorer({
  notebooks,
  newNotebookName,
  setNewNotebookName,
  addNotebook,
  selectedNotebook,
  setSelectedNotebook,
  loadNotes,
  notes,
  newNote,
  setNewNote,
  addNote,
  deleteNotebook,
  deleteNote,
  updateNote,
  updateNotebook,
  setSelectedNote,
  init,
  cloudBackup,
}) {
  const [showAddNotebook, setShowAddNotebook] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayType, setDisplayType] = useState("grid");
  const [folderContextVisible, setFolderContextVisible] = useState(null);
  const [notebookContextId, setNotebookContextId] = useState(null);
  const [sortDialogVisible, setSortDialogVisible] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [noteContextVisible, setNoteContextVisible] = useState(null);
  const [noteContextId, setNoteContextId] = useState(null);
  const [pendingDeleteNotebookId, setPendingDeleteNotebookId] = useState(null);

  const dialogRef = useRef(null);
  const noteContextMenuRef = useRef(null);

  const filteredNotebooks = notebooks
    .filter((nb) => nb.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "created_at") {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setShowAddNotebook(false);
        setSearchBarVisible(false);
        setShowNewNote(false);
        setFolderContextVisible(null);
        setNotebookContextId(null);
        setNoteContextVisible(null);
        setNoteContextId(null);
        setSelectedNotebook(null);
        setSortDialogVisible(false);
      }
    }

    function handleClickOutside(e) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target) &&
        (!noteContextMenuRef.current ||
          !noteContextMenuRef.current.contains(e.target))
      ) {
        setShowAddNotebook(false);
        setShowNewNote(false);
        setSelectedNotebook(null);
        setNotebookContextId(null);
        setNoteContextVisible(null);
        setNoteContextId(null);
        setSortDialogVisible(false);
        setSearchBarVisible(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.explorerContainer}>
      {/* EMPTY STATE */}
      {notebooks.length === 0 && (
        <div className={styles.emptyContainer}>
          <h2 className={styles.emptyTitle}>No notebooks yet</h2>
          <p className={styles.emptySubtitle}>
            Create your first notebook to get started!
          </p>
          <button
            className={styles.addNotebookButton}
            onClick={() => setShowAddNotebook(true)}
          >
            <PlusIcon size={32} className={styles.addNotebookIcon} />
            Create Notebook
          </button>
        </div>
      )}

      {/* ADD NOTEBOOK MODAL */}
      {showAddNotebook && (
        <div className={styles.overlay}>
          <div ref={dialogRef} className={styles.addNotebookDialog}>
            <input
              type="text"
              placeholder="Enter name"
              className={styles.addNotebookInput}
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
            />
            <button
              className={styles.addNotebookButton}
              onClick={async () => {
                if (!newNotebookName.trim()) return;

                await addNotebook();

                setShowAddNotebook(false);
                setNewNotebookName("");
              }}
            >
              <PlusIcon size={32} className={styles.addNotebookIcon} />
              Create Notebook
            </button>
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className={styles.toolBar}>
        {notebooks.length > 0 && (
          <>
          <button
            type="button"
            className={styles.toolBarIcon}
            aria-label="Create notebook"
            onClick={() => setShowAddNotebook(true)}
          >
            <FolderSimplePlusIcon size={24} />
          </button>
          <button
            type="button"
            className={styles.toolBarIcon}
            aria-label="Sort notebooks"
            onClick={() => setSortDialogVisible(true)}
          >
            <FunnelSimpleIcon size={24} />
          </button>

          {displayType === "grid" ? (
            <button
              type="button"
              className={styles.toolBarIcon}
              aria-label="Show notebooks as list"
              onClick={() => setDisplayType("list")}
            >
              <ListIcon size={24} />
            </button>
          ) : (
            <button
              type="button"
              className={styles.toolBarIcon}
              aria-label="Show notebooks as grid"
              onClick={() => setDisplayType("grid")}
            >
              <SquaresFourIcon size={24} />
            </button>
          )}

          <button
            type="button"
            className={styles.toolBarIcon}
            aria-label="Reload notebooks"
            onClick={init}
          >
            <ArrowsClockwiseIcon size={24} />
          </button>

          <button
            type="button"
            className={styles.toolBarIcon}
            aria-label="Search notebooks"
            onClick={() => setSearchBarVisible(true)}
          >
            <MagnifyingGlassIcon size={24} />
          </button>
          </>
        )}
        {cloudBackup}
      </div>

      {/* SORT DIALOG */}
      {sortDialogVisible && (
        <div className={styles.sortDialog} ref={dialogRef}>
          <button type="button" onClick={() => setSortBy("name")}>
            <input
              type="radio"
              name="sortBy"
              value="name"
              checked={sortBy === "name"}
              onChange={() => setSortBy("name")}
            />
            <p>Name (A-Z)</p>
          </button>
          <button type="button" onClick={() => setSortBy("created_at")}>
            <input
              type="radio"
              name="sortBy"
              value="created_at"
              checked={sortBy === "created_at"}
              onChange={() => setSortBy("created_at")}
            />
            <p>Created At (Newest First)</p>
          </button>
        </div>
      )}

      {/* SEARCH */}
      {searchBarVisible && (
        <div className={styles.searchBar} ref={dialogRef}>
          <input
            type="text"
            placeholder="Search notebooks..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            type="button"
            className={styles.closeIcon}
            aria-label="Close search"
            onClick={() => {
              setSearchBarVisible(false);
              setSearchTerm("");
            }}
          >
            <XIcon size={32} />
          </button>
        </div>
      )}

      {/* NOTE CONTEXT MENU */}
      {noteContextVisible && (
        <div
          className={`${styles.overlay} ${styles.noteContextOverlay}`}
          onClick={() => setNoteContextVisible(null)}
        >
          <div
            ref={noteContextMenuRef}
            className={styles.noteContextMenu}
            style={{
              top: `${noteContextVisible.y}px`,
              left: `${noteContextVisible.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={async () => {
                if (!noteContextId) return;

                const note = notes.find((n) => n.id === noteContextId);
                if (!note) return;

                const newName = window.prompt(
                  "Enter new note title:",
                  note.name || "Untitled",
                );

                if (newName?.trim()) {
                  await updateNote(noteContextId, { name: newName.trim() });
                  await loadNotes(selectedNotebook);
                }

                setNoteContextVisible(null);
              }}
            >
              <PencilSimpleIcon size={24} /> Rename
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!noteContextId) return;

                if (window.confirm("Delete this note?")) {
                  await deleteNote(noteContextId);
                }

                setNoteContextVisible(null);
              }}
            >
              <TrashIcon size={24} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* NOTES OVERLAY */}
      {selectedNotebook && (
        <div className={styles.overlay}>
          <div className={styles.noteList} ref={dialogRef}>
            <p className={styles.notebookTitle}>
              Notebook: {" "}
              {notebooks.find((nb) => nb.id === selectedNotebook)?.name ||
                "Untitled Notebook"}
            </p>
            {showNewNote ? (
              <div className={styles.newNoteContainer}>
                <input
                  type="text"
                  placeholder="Enter note title..."
                  className={styles.newNoteInput}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <button
                  className={styles.addNoteButton}
                  onClick={async () => {
                    if (!newNote.trim()) return;
                    await addNote();
                    setShowNewNote(false);
                  }}
                >
                  <PlusIcon size={32} className={styles.addNoteIcon} />
                  Create Note
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.newNoteItem}
                onClick={() => setShowNewNote(true)}
              >
                <img src="/new.svg" alt="New Note" />
                New Note
              </button>
            )}

            {notes.length === 0 ? (
              <p className={styles.emptyMessage}>
                No notes yet. Create your first note!
              </p>
            ) : (
              <div className={styles.notesContainer}>
                {notes.map((note) => (
                  <button
                    type="button"
                    key={note.id}
                    className={styles.noteItem}
                    onClick={() => setSelectedNote(note)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setNoteContextId(note.id);
                      setNoteContextVisible({ x: e.clientX, y: e.clientY });
                    }}
                  >
                    <img src="/note.svg" alt="Note" />
                    {(() => {
                      try {
                        const name = note.name || "Untitled";
                        return name.length > 25
                          ? name.slice(0, 25) + "..."
                          : name;
                      } catch {
                        return "Untitled";
                      }
                    })()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {folderContextVisible && (
        <div
          className={styles.overlay}
          onClick={() => setFolderContextVisible(null)}
        >
          <div
            className={styles.folderContextMenu}
            style={{
              top: `${folderContextVisible.y}px`,
              left: `${folderContextVisible.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (!notebookContextId) return;

                const newName = window.prompt(
                  "Enter new notebook name:",
                  notebooks.find((nb) => nb.id === notebookContextId)?.name ||
                    "",
                );

                if (newName?.trim()) {
                  updateNotebook(notebookContextId, newName.trim());
                }

                setFolderContextVisible(null);
              }}
            >
              <PencilSimpleIcon size={24} /> Rename
            </button>

            <button
              type="button"
              onClick={() => {
                if (!notebookContextId) return;
                setFolderContextVisible(null);
                setPendingDeleteNotebookId(notebookContextId);
              }}
            >
              <TrashIcon size={24} /> Delete
            </button>
          </div>
        </div>
      )}

      {pendingDeleteNotebookId && (
        <div
          className={styles.overlay}
          onClick={() => setPendingDeleteNotebookId(null)}
        >
          <div
            ref={dialogRef}
            className={styles.addNotebookDialog}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Delete notebook?</h2>
            <p>This will permanently delete the notebook and all its notes.</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setPendingDeleteNotebookId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={async () => {
                  const notebookId = pendingDeleteNotebookId;
                  setPendingDeleteNotebookId(null);
                  await deleteNotebook(notebookId);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTEBOOK LIST */}
      <ul className={displayType === "grid" ? styles.grid : styles.list}>
        {filteredNotebooks.map((nb) => (
          <li
            key={nb.id}
            className={styles.notebookItem}
            tabIndex={0}
            role="button"
            onContextMenu={(e) => {
              e.preventDefault();
              setNotebookContextId(nb.id);
              setFolderContextVisible({ x: e.clientX, y: e.clientY });
            }}
            onClick={() => {
              setSelectedNotebook(nb.id);
              loadNotes(nb.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedNotebook(nb.id);
                loadNotes(nb.id);
              }
            }}
          >
            <span>
              <img src="/folder.svg" alt="Notebook" />
              {nb.name.length > 20 && displayType === "grid" ? (
                <p>{nb.name.slice(0, 17) + "..."}</p>
              ) : (
                <p>{nb.name}</p>
              )}
            </span>
            {displayType === "list" && (
              <div className={styles.listDetails}>
                <p>{nb.notes_count} notes</p>
                <p>
                  Created:{" "}
                  {new Date(nb.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
