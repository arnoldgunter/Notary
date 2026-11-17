import { lazy, Suspense, useState, useEffect } from "react";
import {
  initDB,
  addNotebook,
  getNotes,
  addNote,
  getNotebooks,
  getNoteById,
  deleteNote,
  deleteNotebook,
  updateNote,
  updateNotebook,
} from "./lib/db";
import "./App.css";
import { XIcon } from "@phosphor-icons/react";
import Splash from "./components/splash";
import NotebookExplorer from "./components/NotebookExplorer";

const BackupPopover = lazy(() => import("./components/BackupPopover"));
const SimpleEditor = lazy(() =>
  import("@/components/tiptap-templates/simple/simple-editor").then((module) => ({
    default: module.SimpleEditor,
  })),
);

function App() {
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [notebooks, setNotebooks] = useState([]);
  const [selectedNotebook, setSelectedNotebook] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (!initialized) return;
    const saved = localStorage.getItem("selectedNoteId");
    if (saved) {
      try {
        const noteId = JSON.parse(saved);

        const fetchNote = async () => {
          try {
            const note = await getNoteById(noteId);
            if (note) setSelectedNote(note);
          } catch (error) {
            console.error("Failed to restore selected note:", error);
            localStorage.removeItem("selectedNoteId");
          }
        };

        fetchNote();
      } catch (error) {
        console.warn("Invalid saved note selection:", error);
        localStorage.removeItem("selectedNoteId");
      }
    }
  }, [initialized]);

  useEffect(() => {
    if (selectedNote) {
      localStorage.setItem("selectedNoteId", JSON.stringify(selectedNote.id));
    } else {
      localStorage.removeItem("selectedNoteId");
    }
  }, [selectedNote?.id]);

  const init = async () => {
    setLoading(true);
    setInitializationError(null);
    try {
      await initDB();
      await loadNotebooks();
      setInitialized(true);
    } catch (error) {
      console.error("Failed to initialize database:", error);
      setInitializationError(
        error instanceof Error
          ? error.message
          : "Die lokale Datenbank konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const loadNotebooks = async () => {
    const notebooks = await getNotebooks();
    setNotebooks(notebooks);
  };

  const loadNotes = async (notebookId) => {
    if (!notebookId) return;
    const n = await getNotes(notebookId);
    setNotes(n);
  };

  const handleDatabaseChanged = async () => {
    setSelectedNotebook(null);
    setSelectedNote(null);
    setNotes([]);
    await loadNotebooks();
  };

  const handleAddNotebook = async () => {
    if (!newNotebookName.trim()) return;
    await addNotebook(newNotebookName);
    setNewNotebookName("");
    await loadNotebooks();
  };

  const handleAddNote = async () => {
    if (!selectedNotebook) return;

    await addNote(selectedNotebook, {
      name: newNote.trim() || "Untitled",
      content: {
        type: "doc",
        content: [],
      },
    });

    setNewNote("");
    await loadNotes(selectedNotebook);
  };

  const handleDeleteNote = async (noteId) => {
    await deleteNote(noteId);
    await loadNotes(selectedNotebook);

    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
  };

  const handleDeleteNotebook = async (notebookId) => {
    await deleteNotebook(notebookId);
    await loadNotebooks();
    setSelectedNotebook(null);
    setNotes([]);
    setSelectedNote(null);
  };

  const handleUpdateNote = async (noteId, content) => {
    try {
      const parsedContent =
        typeof content === "string" ? JSON.parse(content) : content;
      await updateNote(noteId, JSON.stringify(parsedContent));
    } catch (error) {
      console.error("Failed to update note:", error);
    }
  };

  const handleUpdateNotebook = async (notebookId, name) => {
    await updateNotebook(notebookId, name);
    await loadNotebooks();
  };

  if (loading) return <Splash />;

  if (initializationError) {
    return (
      <main className="app-error">
        <h1>Notary konnte nicht gestartet werden</h1>
        <p>{initializationError}</p>
        <button type="button" onClick={init}>Erneut versuchen</button>
      </main>
    );
  }

  if (!selectedNote) {
    return (
      <div className="app-container" onContextMenu={(e) => e.preventDefault()}>
        <NotebookExplorer
          notebooks={notebooks}
          addNotebook={handleAddNotebook}
          newNotebookName={newNotebookName}
          setNewNotebookName={setNewNotebookName}
          selectedNotebook={selectedNotebook}
          setSelectedNotebook={setSelectedNotebook}
          loadNotes={loadNotes}
          notes={notes}
          newNote={newNote}
          setNewNote={setNewNote}
          addNote={handleAddNote}
          deleteNotebook={handleDeleteNotebook}
          deleteNote={handleDeleteNote}
          updateNote={handleUpdateNote}
          updateNotebook={handleUpdateNotebook}
          selectedNote={selectedNote}
          setSelectedNote={setSelectedNote}
          init={init}
          cloudBackup={
            <Suspense fallback={null}>
              <BackupPopover onDatabaseChanged={handleDatabaseChanged} />
            </Suspense>
          }
        />
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      <div className="note-header">
        <button
          type="button"
          className="closeNoteBtn"
          aria-label="Close note"
          onClick={() => {
            setSelectedNote(null);
            loadNotes(selectedNotebook);
          }}
        >
          <XIcon size={24} />
        </button>
        {selectedNote.name.length > 20
          ? <p>{selectedNote.name.slice(0, 20) + "..."}</p>
          : <p>{selectedNote.name}</p>}
      </div>

      <Suspense fallback={<Splash />}>
        <SimpleEditor
          note={selectedNote}
          onUpdate={(content) => handleUpdateNote(selectedNote.id, content)}
        />
      </Suspense>
    </div>
  );
}

export default App;
