import { useEffect, useState } from "react";
import { api } from "../api";
import { DRAWER_PARAM_LABELS } from "../constants/rubrics";
import { esc, formatDateStr, ratingClass } from "../utils/helpers";

export default function DetailDrawer({ open, token, user, obsId, onClose, onUpdated }) {
  const [obs, setObs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editedFeedback, setEditedFeedback] = useState("");
  const [editedObjectiveObs, setEditedObjectiveObs] = useState("");
  const [editedRemarks, setEditedRemarks] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!open || !obsId) return;
    setLoading(true);
    setLoadError("");
    setObs(null);
    api
      .getObservation(token, obsId)
      .then((data) => {
        setObs(data);
        setEditedFeedback(data.ai_feedback || "");
        setEditedObjectiveObs(data.objective_observations || "");
        setEditedRemarks(data.teacher_remarks || "");
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [open, obsId, token]);

  const isCreator = obs && user && obs.auditor_id === user.id;
  const isDraftEditable = obs?.is_draft && isCreator;
  const isTeacherRemarking =
    obs && user?.role === "teacher" && !obs.is_draft && !obs.remarks_saved;

  const showActionPanel = isDraftEditable || isTeacherRemarking;
  const actionLabel = isDraftEditable ? "Finalise Audit & Send Notification" : "Save My Remarks";

  const handleAction = async () => {
    if (!obs) return;
    setActionError("");
    setActionLoading(true);
    try {
      if (isDraftEditable) {
        await api.updateDraft(token, obs.id, {
          objective_observations: editedObjectiveObs,
          ai_feedback: editedFeedback,
        });
        await api.finaliseObservation(token, obs.id);
        onClose();
        onUpdated();
      } else if (isTeacherRemarking) {
        if (!editedRemarks.trim()) {
          setActionError("Remarks cannot be empty.");
          setActionLoading(false);
          return;
        }
        await api.saveRemarks(token, obs.id, editedRemarks.trim());
        onClose();
        onUpdated();
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const title = obs ? obs.teacher.name : "Observation Detail";
  const subtitle = obs
    ? `${obs.school} Campus · ${obs.subject} · ${obs.grade} ${obs.section}`
    : loading
    ? "Loading..."
    : "";

  return (
    <>
      <div className={`drawer-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`drawer${open ? " open" : ""}`}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">{title}</h2>
            <div className="drawer-subtitle">{subtitle}</div>
          </div>
          <button className="btn-close-drawer flex-center" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          {loading && <div className="msg"><span className="spinner" />Loading observation...</div>}
          {loadError && <div className="error-banner">{loadError}</div>}

          {obs && (
            <>
              {/* Score + status header */}
              <div className="drawer-score-row">
                <div className="drawer-score-big">{obs.overall_score}/28</div>
                <div className="drawer-score-meta">
                  <div className={`drawer-rating-tag ${ratingClass(obs.rating)}`}>{obs.rating}</div>
                  <div className="drawer-score-lbl">
                    {formatDateStr(obs.date_time)} · Auditor: {obs.auditor.name}
                  </div>
                  {obs.is_draft && (
                    <div style={{ marginTop: "4px" }}>
                      <span className="tc-status-badge draft">DRAFT</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Domain parameter scores */}
              <div className="drawer-section-label">Domain Parameters Rating</div>
              <div className="drawer-params-box">
                <div className="hc-params-grid">
                  {DRAWER_PARAM_LABELS.map(([key, label]) => (
                    <div className="hc-param-item" key={key}>
                      <span>{label}</span>
                      <span className="hc-param-val">{obs[key]}/4</span>
                    </div>
                  ))}
                </div>
                {/* Domain totals */}
                <div className="domain-totals-row">
                  <span className="domain-total-pill">D1: {obs.domain1_score}/8</span>
                  <span className="domain-total-pill">D2: {obs.domain2_score}/4</span>
                  <span className="domain-total-pill">D3: {obs.domain3_score}/16</span>
                  <span className="domain-total-pill total">Total: {obs.overall_score}/28</span>
                </div>
              </div>

              <div className="drawer-section-label">Observation Details</div>

              {/* Objective observations — editable if draft creator */}
              <div className="info-card">
                <div className="hc-lbl">Objective Observations & Timestamps</div>
                {isDraftEditable ? (
                  <textarea
                    className="input-text"
                    style={{ minHeight: "140px", fontSize: "13px", lineHeight: 1.6 }}
                    value={editedObjectiveObs}
                    onChange={(e) => setEditedObjectiveObs(e.target.value)}
                    placeholder="Add timestamped observation notes..."
                  />
                ) : (
                  <div className="hc-val" style={{ fontSize: "13px" }}>
                    {obs.objective_observations ? (
                      obs.objective_observations.split("\n").map((n, idx) => {
                        const parts = n.split(" ");
                        return (
                          <div key={idx} style={{ marginBottom: "4px" }}>
                            <span className="remark-time">{parts[0]}</span>
                            {esc(parts.slice(1).join(" "))}
                          </div>
                        );
                      })
                    ) : (
                      <em style={{ color: "var(--text-muted)" }}>No observation notes recorded.</em>
                    )}
                  </div>
                )}
              </div>

              {/* Infrastructure issues — view only */}
              {obs.infrastructure_issues && (
                <div className="info-card">
                  <div className="hc-lbl">Infrastructure Issues</div>
                  <div className="hc-val" style={{ fontSize: "13px" }}>{obs.infrastructure_issues}</div>
                </div>
              )}

              {/* Other issues — view only */}
              {obs.other_issues && (
                <div className="info-card">
                  <div className="hc-lbl">Other Issues</div>
                  <div className="hc-val" style={{ fontSize: "13px" }}>{obs.other_issues}</div>
                </div>
              )}

              {/* Images — view only */}
              {obs.images?.length > 0 && (
                <div className="info-card">
                  <div className="hc-lbl">Observation Images</div>
                  <div className="hc-images-grid">
                    {obs.images.map((img) => (
                      <div className="hc-img-item" key={img.id}>
                        <img
                          src={img.image_path}
                          alt="Observation"
                          onClick={() => window.open(img.image_path, "_blank")}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI feedback — editable if draft creator */}
              <div className="info-card">
                <div className="hc-lbl">AI-Generated Feedback for Teacher</div>
                {isDraftEditable ? (
                  <textarea
                    className="input-text"
                    style={{ minHeight: "160px", fontSize: "13px", lineHeight: 1.6 }}
                    value={editedFeedback}
                    onChange={(e) => setEditedFeedback(e.target.value)}
                  />
                ) : (
                  <div className="hc-val ai-box">
                    {obs.ai_feedback || "No AI feedback generated yet."}
                  </div>
                )}
              </div>

              {/* Teacher remarks */}
              <div className="info-card">
                <div className="hc-lbl">Teacher&apos;s Remarks</div>
                {isTeacherRemarking ? (
                  <textarea
                    className="input-text"
                    placeholder="Write your remarks or reflections..."
                    style={{ minHeight: "80px", fontSize: "13px" }}
                    value={editedRemarks}
                    onChange={(e) => setEditedRemarks(e.target.value)}
                  />
                ) : (
                  <div className="hc-val teacher-box">
                    {obs.teacher_remarks || "No teacher response submitted yet."}
                  </div>
                )}
              </div>

              {/* Action panel */}
              {showActionPanel && (
                <div className="drawer-draft-actions">
                  {actionError && (
                    <div className="error-banner" style={{ marginBottom: "12px" }}>{actionError}</div>
                  )}
                  <button
                    className="btn-submit-large"
                    style={{ width: "100%" }}
                    disabled={actionLoading}
                    onClick={handleAction}
                  >
                    {actionLoading
                      ? <><span className="spinner" />Processing...</>
                      : actionLabel}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
