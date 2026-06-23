import { useEffect, useState } from "react";
import { api } from "../api";
import { DRAWER_PARAM_LABELS } from "../constants/rubrics";
import { esc, formatDateStr, ratingClass } from "../utils/helpers";

const PARAM_MAX = { p11: 4, p12: 4, p21: 4, p31: 4, p32: 4, p33: 4, p34: 4 };

function ScoreSelect({ paramKey, value, onChange }) {
  return (
    <select
      className="input-text"
      style={{ padding: "4px 8px", fontSize: "13px", width: "80px" }}
      value={value}
      onChange={(e) => onChange(paramKey, parseInt(e.target.value, 10))}
    >
      {[1, 2, 3, 4].map((v) => (
        <option key={v} value={v}>{v}/4</option>
      ))}
    </select>
  );
}

export default function DetailDrawer({ open, token, user, obsId, onClose, onUpdated }) {
  const [obs, setObs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editedFeedback, setEditedFeedback] = useState("");
  const [editedObjectiveObs, setEditedObjectiveObs] = useState("");
  const [editedRemarks, setEditedRemarks] = useState("");
  const [editedAuditorRemarks, setEditedAuditorRemarks] = useState("");
  const [editedScores, setEditedScores] = useState({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [witnessDesignation, setWitnessDesignation] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!open || !obsId) return;
    setLoading(true);
    setLoadError("");
    setObs(null);
    setAcknowledged(false);
    api
      .getObservation(token, obsId)
      .then((data) => {
        setObs(data);
        setEditedFeedback(data.ai_feedback || "");
        setEditedObjectiveObs(data.objective_observations || "");
        setEditedRemarks(data.teacher_remarks || "");
        setEditedAuditorRemarks(data.auditor_remarks || "");
        setEditedScores({
          p11: data.p11, p12: data.p12, p21: data.p21,
          p31: data.p31, p32: data.p32, p33: data.p33, p34: data.p34,
        });
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [open, obsId, token]);

  const isCreator = obs && user && obs.auditor_id === user.id;
  const isDraftEditable = obs?.is_draft && isCreator;
  const isSME = user?.role === "sme";
  const isTeacher = user?.role === "teacher";
  const isTeacherRemarking = obs && isTeacher && !obs.is_draft && !obs.remarks_saved;

  const showActionPanel = isDraftEditable || isTeacherRemarking;
  const actionLabel = isDraftEditable ? "Finalise Audit & Send Notification" : "Save My Remarks";

  // Finalize disabled for SME until acknowledged with name + designation filled
  const smeAckComplete = acknowledged && witnessName.trim() && witnessDesignation.trim();
  const finalizeDisabled = actionLoading || (isDraftEditable && isSME && !smeAckComplete);

  const handleScoreChange = (key, val) => {
    setEditedScores((prev) => ({ ...prev, [key]: val }));
  };

  // Live recalculate scores for display
  const liveD1 = (editedScores.p11 || 0) + (editedScores.p12 || 0);
  const liveD2 = editedScores.p21 || 0;
  const liveD3 = (editedScores.p31 || 0) + (editedScores.p32 || 0) + (editedScores.p33 || 0) + (editedScores.p34 || 0);
  const liveTotal = liveD1 + liveD2 + liveD3;

  const handleAction = async () => {
    if (!obs) return;
    setActionError("");
    setActionLoading(true);
    try {
      if (isDraftEditable) {
        await api.updateDraft(token, obs.id, {
          objective_observations: editedObjectiveObs,
          ai_feedback: editedFeedback,
          auditor_remarks: editedAuditorRemarks,
          ...editedScores,
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
    : loading ? "Loading..." : "";

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
                <div className="drawer-score-big">
                  {isDraftEditable ? liveTotal : obs.overall_score}/28
                </div>
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
                {isDraftEditable ? (
                  // Editable score selectors
                  <div className="hc-params-grid">
                    {DRAWER_PARAM_LABELS.map(([key, label]) => (
                      <div className="hc-param-item" key={key} style={{ justifyContent: "space-between" }}>
                        <span>{label}</span>
                        <ScoreSelect paramKey={key} value={editedScores[key] || 1} onChange={handleScoreChange} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="hc-params-grid">
                    {DRAWER_PARAM_LABELS.map(([key, label]) => (
                      <div className="hc-param-item" key={key}>
                        <span>{label}</span>
                        <span className="hc-param-val">{obs[key]}/4</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Domain totals */}
                <div className="domain-totals-row">
                  <span className="domain-total-pill">D1: {isDraftEditable ? liveD1 : obs.domain1_score}/8</span>
                  <span className="domain-total-pill">D2: {isDraftEditable ? liveD2 : obs.domain2_score}/4</span>
                  <span className="domain-total-pill">D3: {isDraftEditable ? liveD3 : obs.domain3_score}/16</span>
                  <span className="domain-total-pill total">Total: {isDraftEditable ? liveTotal : obs.overall_score}/28</span>
                </div>

                {/* Auditor remarks — shown to all, editable by draft creator */}
                {(isDraftEditable || obs.auditor_remarks) && (
                  <div style={{ marginTop: "12px" }}>
                    <div className="hc-lbl" style={{ marginBottom: "6px" }}>Auditor / SME Remarks</div>
                    {isDraftEditable ? (
                      <textarea
                        className="input-text"
                        style={{ minHeight: "80px", fontSize: "13px" }}
                        placeholder="Overall remarks and suggestions..."
                        value={editedAuditorRemarks}
                        onChange={(e) => setEditedAuditorRemarks(e.target.value)}
                      />
                    ) : (
                      <div className="hc-val" style={{ fontSize: "13px" }}>
                        {obs.auditor_remarks || <em style={{ color: "var(--text-muted)" }}>No remarks recorded.</em>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Observation Details — hidden from teacher */}
              {!isTeacher && (
                <>
                  <div className="drawer-section-label">Observation Details</div>

                  <div className="info-card">
                    <div className="hc-lbl">Objective Observations &amp; Timestamps</div>
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

                  {obs.infrastructure_issues && (
                    <div className="info-card">
                      <div className="hc-lbl">Infrastructure Issues</div>
                      <div className="hc-val" style={{ fontSize: "13px" }}>{obs.infrastructure_issues}</div>
                    </div>
                  )}

                  {obs.other_issues && (
                    <div className="info-card">
                      <div className="hc-lbl">Other Issues</div>
                      <div className="hc-val" style={{ fontSize: "13px" }}>{obs.other_issues}</div>
                    </div>
                  )}

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
                </>
              )}

              {/* AI feedback */}
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

              {/* Neutral person acknowledgment — only for SME drafts */}
              {isDraftEditable && isSME && (
                <div className="info-card" style={{ border: smeAckComplete ? "1px solid var(--harvest-green)" : "1px solid var(--border)" }}>
                  <div className="hc-lbl" style={{ marginBottom: "10px" }}>Mutual Agreement Acknowledgment</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="field-label">Witness Name</label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="Full name"
                        value={witnessName}
                        onChange={(e) => setWitnessName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="field-label">Designation</label>
                      <input
                        type="text"
                        className="input-text"
                        placeholder="e.g. Vice Principal"
                        value={witnessDesignation}
                        onChange={(e) => setWitnessDesignation(e.target.value)}
                      />
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-white)", lineHeight: 1.6 }}>
                      I confirm that this observation report has been reviewed and mutually agreed upon by the SME and the teacher in my presence. Both parties have acknowledged the feedback and domain scores.
                    </span>
                  </label>
                  {!smeAckComplete && (
                    <div style={{ fontSize: "11px", color: "var(--harvest-amber)", marginTop: "8px" }}>
                      Please fill in your name, designation and check the box to enable finalisation.
                    </div>
                  )}
                </div>
              )}

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
                    style={{ width: "100%", opacity: finalizeDisabled ? 0.5 : 1 }}
                    disabled={finalizeDisabled}
                    onClick={handleAction}
                  >
                    {actionLoading
                      ? <><span className="spinner" />Processing...</>
                      : actionLabel}
                  </button>
                  {isDraftEditable && isSME && !smeAckComplete && (
                    <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                      Complete the acknowledgment section above to enable this button.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
