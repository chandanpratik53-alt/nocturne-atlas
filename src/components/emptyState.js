// src/components/emptyState.js
// Reusable accessible empty state and placeholder renderer

/**
 * Render a meaningful, accessible empty state card
 * @param {Object} options
 * @param {string} options.title - Header text
 * @param {string} options.description - Clear explanation
 * @param {string} [options.badge] - Optional status badge (e.g. "Phase 2 Target", "Waiting for data")
 * @param {string} [options.actionLabel] - Optional button label
 * @param {string} [options.actionId] - Button ID for binding
 * @param {string} [options.icon] - Inline SVG or icon marker
 */
export function renderEmptyState({
  title,
  description,
  badge = '',
  actionLabel = '',
  actionId = '',
  icon = ''
}) {
  return `
    <div class="empty-state-card" role="region" aria-label="${escapeHtml(title)}">
      ${icon ? `<div class="empty-state-icon" aria-hidden="true">${icon}</div>` : ''}
      <div class="empty-state-content">
        <div class="empty-state-header">
          <h3 class="empty-state-title">${escapeHtml(title)}</h3>
          ${badge ? `<span class="badge badge-subtle">${escapeHtml(badge)}</span>` : ''}
        </div>
        <p class="empty-state-desc">${escapeHtml(description)}</p>
        ${actionLabel ? `
          <div class="empty-state-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="${escapeHtml(actionId)}">
              ${escapeHtml(actionLabel)}
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
