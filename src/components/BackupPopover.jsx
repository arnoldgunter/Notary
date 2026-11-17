import { useEffect, useState } from "react";
import { CloudArrowUpIcon, CloudIcon, XIcon } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  downloadDatabase,
  getGoogleAccount,
  isGoogleDriveConfigured,
  uploadDatabase,
} from "../lib/googleDrive";
import { getDatabasePath, readDatabase, replaceDatabase } from "../lib/db";
import "./BackupPopover.css";

function BackupPopover({ onDatabaseChanged }) {
  const [isOpen, setIsOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [databasePath, setDatabasePath] = useState("");

  useEffect(() => {
    getGoogleAccount().then(setAccount).catch(() => setAccount(null));
    getDatabasePath().then(setDatabasePath).catch(() => setDatabasePath(""));
  }, []);

  const run = async (operation) => {
    setBusy(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : error?.message || error?.error || JSON.stringify(error);
      setMessage(details || "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const nextAccount = await connectGoogleDrive();
      setAccount(nextAccount);
      setMessage("Google Drive ist verbunden.");
    });

  const importLocal = () =>
    run(async () => {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "SQLite-Datenbank", extensions: ["db", "sqlite"] }],
      });
      if (!path || Array.isArray(path)) return;
      await replaceDatabase(await readFile(path));
      await onDatabaseChanged();
      setMessage("Lokale Datenbank wurde importiert.");
    });

  return (
    <div className="backup-widget">
      {isOpen && (
        <section className="backup-popover" aria-label="Datenbank-Backup">
          <div className="backup-popover-header">
            <div>
              <strong>Cloud-Backup</strong>
              <span>{account ? account.email : "Nur lokale Datenbank"}</span>
            </div>
            {databasePath && (
              <p className="backup-database-path">
                Lokale Originaldatenbank:
                <code>{databasePath}</code>
              </p>
            )}
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Schließen">
              <XIcon size={18} />
            </button>
          </div>

          {!account ? (
            <>
              <button
                type="button"
                className="backup-action backup-action-primary"
                onClick={connect}
                disabled={busy}
              >
                <CloudIcon size={20} />
                Mit Google Drive verbinden
              </button>
              {!isGoogleDriveConfigured() && (
                <p className="backup-hint">
                  Google Drive ist für diese App noch nicht konfiguriert.
                </p>
              )}
            </>
          ) : (
            <>
              <button type="button" className="backup-action" onClick={() => run(async () => {
                await uploadDatabase(await readDatabase());
                setMessage("Backup wurde in Google Drive erstellt.");
              })} disabled={busy}>
                <CloudArrowUpIcon size={20} />
                Backup auf Google Drive erstellen
              </button>
              <button type="button" className="backup-action" onClick={() => run(async () => {
                await replaceDatabase(await downloadDatabase());
                await onDatabaseChanged();
                setMessage("Google-Drive-Datenbank wurde importiert.");
              })} disabled={busy}>
                <CloudIcon size={20} />
                Datenbank von Google Drive importieren
              </button>
              <button type="button" className="backup-link" onClick={() => run(async () => {
                disconnectGoogleDrive();
                setAccount(null);
              })} disabled={busy}>
                Google Drive trennen
              </button>
            </>
          )}

          <button type="button" className="backup-action backup-action-local" onClick={importLocal} disabled={busy}>
            Lokale Datei importieren
          </button>
          {message && <p className="backup-message">{message}</p>}
        </section>
      )}
      <button
        type="button"
        className={`backup-trigger ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((openState) => !openState)}
        aria-label="Cloud-Backup öffnen"
        title="Cloud-Backup"
      >
        <CloudIcon size={24} weight={account ? "fill" : "regular"} />
      </button>
    </div>
  );
}

export default BackupPopover;
