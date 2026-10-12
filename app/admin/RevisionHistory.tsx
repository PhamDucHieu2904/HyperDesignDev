import { ArrowLeft, Check, Clock3, Eye, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AdminMediaAsset, AdminProject, AdminRevision, AdminRevisionSummary } from "../../shared/contracts";
import { getAdminRevision, listAdminRevisions } from "./repository";
import { ArticlePreview } from "./ArticlePreview";

function revisionDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function RevisionHistory({ project, media, hasUnsavedChanges, onClose, onRestore }: {
  project: AdminProject;
  media: AdminMediaAsset[];
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onRestore: (revision: AdminRevisionSummary) => Promise<void>;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewBackRef = useRef<HTMLButtonElement>(null);
  const restoreCancelRef = useRef<HTMLButtonElement>(null);
  const [revisions, setRevisions] = useState<AdminRevisionSummary[]>([]);
  const [selected, setSelected] = useState<AdminRevision | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminRevisionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || restoring) return;
      if (restoreTarget) setRestoreTarget(null);
      else if (selected) setSelected(null);
      else onClose();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose, restoreTarget, restoring, selected]);

  useEffect(() => {
    if (selected && !restoreTarget) previewBackRef.current?.focus();
  }, [restoreTarget, selected]);

  useEffect(() => {
    if (restoreTarget) restoreCancelRef.current?.focus();
  }, [restoreTarget]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listAdminRevisions(project.id).then(items => { if (active) setRevisions(items); })
      .catch(nextError => { if (active) setError(nextError instanceof Error ? nextError.message : "Revision history could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project.id]);

  const previewRevision = async (revision: AdminRevisionSummary) => {
    setPreviewing(revision.id); setError(null);
    try { setSelected(await getAdminRevision(project.id, revision.id)); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "This revision could not be previewed."); }
    finally { setPreviewing(null); }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true); setError(null); setSuccess(null);
    try {
      await onRestore(restoreTarget);
      setSuccess(`Revision v${restoreTarget.sourceVersion} was copied into the current draft.`);
      setRestoreTarget(null); setSelected(null);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "The revision could not be restored."); }
    finally { setRestoring(false); }
  };

  return <div className="admin-dialog-backdrop admin-revisions-backdrop" role="presentation">
    <section className="admin-revisions" role="dialog" aria-modal="true" aria-labelledby="revision-history-title">
      <header><div><p className="admin-eyebrow">Immutable snapshots</p><h2 id="revision-history-title">Revision history</h2><p>{project.metadata.title}</p></div><button ref={closeRef} type="button" className="admin-icon-button" aria-label="Close revision history" disabled={restoring} onClick={onClose}><X aria-hidden="true" /></button></header>
      {error && <div className="admin-alert admin-alert-error" role="alert"><span>{error}</span></div>}
      {success && <div className="admin-alert admin-alert-success" role="status"><Check aria-hidden="true" /><span>{success} Publish when you are ready to update the public portfolio.</span></div>}
      {selected ? <div className="admin-revision-preview">
        <div className="admin-revision-preview-toolbar"><button ref={previewBackRef} type="button" className="admin-button admin-button-quiet" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" />Back to revisions</button><div><strong>Draft v{selected.sourceVersion}</strong><span>{revisionDate(selected.createdAt)}</span></div><button type="button" className="admin-button admin-button-primary" onClick={() => setRestoreTarget(selected)}><RotateCcw aria-hidden="true" />Restore this revision</button></div>
        <div className="admin-preview-frame"><article><header className="admin-preview-project-header"><span>{selected.metadata.year || "Selected work"} / {selected.metadata.categoryId}</span><h1>{selected.metadata.title}</h1><p>{selected.metadata.subtitle}</p></header><ArticlePreview document={selected.document} media={media} /></article></div>
      </div> : <div className="admin-revision-list" aria-busy={loading}>
        {loading && <div className="admin-revision-empty"><LoaderCircle className="admin-spin" aria-hidden="true" /><p>Loading immutable snapshots…</p></div>}
        {!loading && revisions.length === 0 && <div className="admin-revision-empty"><Clock3 aria-hidden="true" /><h3>No revisions yet</h3><p>Publish the project once to create its first immutable snapshot.</p></div>}
        {revisions.map(revision => <article className={`admin-revision-row ${revision.isPublic ? "is-public" : ""}`} key={revision.id}>
          <div className="admin-revision-number"><span>v{revision.sourceVersion}</span><small>Schema {revision.schemaVersion}</small></div>
          <div className="admin-revision-meta"><strong>{revision.isPublic ? "Currently public" : "Published snapshot"}</strong><span>{revisionDate(revision.createdAt)}</span><small>{revision.createdBy} · {revision.contentState === "ready" ? "Content ready" : "Content empty"}</small></div>
          <div className="admin-revision-actions"><button type="button" className="admin-button admin-button-quiet" disabled={previewing === revision.id} onClick={() => void previewRevision(revision)}>{previewing === revision.id ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}Preview</button><button type="button" className="admin-button admin-button-quiet" onClick={() => setRestoreTarget(revision)}><RotateCcw aria-hidden="true" />Restore</button></div>
        </article>)}
      </div>}
      <footer><p>Restoring never changes the public portfolio until you publish the restored draft.</p><button type="button" className="admin-button admin-button-quiet" disabled={restoring} onClick={onClose}>Done</button></footer>
    </section>
    {restoreTarget && <div className="admin-dialog-backdrop admin-nested-dialog" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !restoring) setRestoreTarget(null); }}><section className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restore-revision-title"><header><div><p className="admin-eyebrow">Draft replacement</p><h2 id="restore-revision-title">Restore revision v{restoreTarget.sourceVersion}?</h2></div><button ref={restoreCancelRef} type="button" className="admin-icon-button" aria-label="Cancel revision restore" disabled={restoring} onClick={() => setRestoreTarget(null)}><X aria-hidden="true" /></button></header><p>This copies the selected immutable snapshot into a new draft version. The currently public revision stays unchanged.</p>{hasUnsavedChanges && <div className="admin-dialog-warning"><RotateCcw aria-hidden="true" /><span>Your unsaved canvas changes will be replaced. The local recovery copy will also be cleared.</span></div>}<footer><button type="button" className="admin-button admin-button-quiet" disabled={restoring} onClick={() => setRestoreTarget(null)}>Cancel</button><button type="button" className="admin-button admin-button-primary" disabled={restoring} onClick={() => void confirmRestore()}>{restoring ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}{restoring ? "Restoring…" : "Restore to draft"}</button></footer></section></div>}
  </div>;
}
