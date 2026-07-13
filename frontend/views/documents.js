(function () {
  const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
  const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
  const ACCEPTED_UPLOAD_TYPES = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

  function dataUrlMime(dataUrl) {
    const match = String(dataUrl || "").match(/^data:([^;,]+)/);
    return match?.[1] || "";
  }

  function inferFileType(file) {
    const explicit = file.type || file.fileType || "";
    if (explicit) return explicit;
    const fromData = dataUrlMime(file.dataUrl);
    if (fromData) return fromData;
    const name = file.name || file.fileName || "";
    if (/\.pdf$/i.test(name)) return "application/pdf";
    if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return "image/*";
    if (/\.(mp4|mov|webm)$/i.test(name)) return "video/*";
    if (/\.(mp3|wav|m4a)$/i.test(name)) return "audio/*";
    if (/\.(docx?|xlsx?|pptx?)$/i.test(name)) return "application/vnd.openxmlformats-officedocument";
    return "";
  }

  function isOfficeFile(type, name) {
    return /word|excel|powerpoint|officedocument|msword|ms-excel|ms-powerpoint/i.test(type || "")
      || /\.(docx?|xlsx?|pptx?)$/i.test(name || "");
  }

  function attachmentTypeLabel(file) {
    const type = inferFileType(file);
    const name = file.name || file.fileName || "";
    if (type.startsWith("image/")) return "Image";
    if (type === "application/pdf") return "PDF";
    if (isOfficeFile(type, name)) return "Document Office";
    if (type.startsWith("video/")) return "Video";
    if (type.startsWith("audio/")) return "Audio";
    return type || "Fichier";
  }

  function stateProxy(getState) {
    return new Proxy({}, {
      get(_target, prop) {
        return getState()[prop];
      },
      set(_target, prop, value) {
        getState()[prop] = value;
        return true;
      }
    });
  }

  window.ClimaParcDocumentsView = {
    limits: {
      documentMaxBytes: DOCUMENT_MAX_BYTES,
      attachmentMaxBytes: ATTACHMENT_MAX_BYTES,
      acceptedUploadTypes: ACCEPTED_UPLOAD_TYPES
    },
    attachmentTypeLabel,
    dataUrlMime,
    inferFileType,
    isOfficeFile,
    create(context) {
      const state = stateProxy(context.getState);
      const {
        api,
        appShell,
        renderTopbar,
        modalShell,
        currentUser,
        can,
        scopedClientDocuments,
        scopedBuildings,
        formatDate,
        escapeHtml,
        statusBadge,
        updateUiState,
        showToast
      } = context;

      function documentsView() {
        const docs = scopedClientDocuments().slice().sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
        const title = currentUser()?.role === "client" ? "Mes documents" : "Documents client";
        const subtitle = currentUser()?.role === "client"
          ? "Contrats, propositions et documents partagés par ClimaParc."
          : "Ajouter et partager des documents avec les comptes clients.";
        return appShell(`
          ${renderTopbar(title, subtitle, currentUser()?.role !== "client" && can("documents") ? `<button class="primary-button" data-action="open-modal" data-modal="clientDocument">Nouveau document</button>` : "")}
          <section class="panel">
            <div class="panel-body cards-list">
              ${docs.map((doc) => clientDocumentItem(doc)).join("") || `<div class="empty">Aucun document disponible.</div>`}
            </div>
          </section>
        `);
      }

      function clientDocumentItem(doc) {
        const client = state.clients.find((item) => item.id === doc.clientId);
        const building = state.buildings.find((item) => item.id === doc.buildingId);
        const apartment = state.apartments.find((item) => item.id === doc.apartmentId);
        const equipment = state.equipment.find((item) => item.id === doc.equipmentId);
        return `
          <article class="list-item">
            <div class="actions" style="justify-content:space-between">
              <h3>${escapeHtml(doc.name)}</h3>
              ${doc.visibleToClient ? statusBadge("active") : statusBadge("inactive")}
            </div>
            <div class="meta">${escapeHtml(doc.type)} | ${formatDate(doc.uploadedAt)} | ${escapeHtml(client?.name || "-")}</div>
            <div class="meta">${[building?.name, apartment ? `Apt ${apartment.number}` : "", equipment?.type].filter(Boolean).map(escapeHtml).join(" - ")}</div>
            ${doc.notes ? `<div class="meta">${escapeHtml(doc.notes)}</div>` : ""}
            <div class="actions">
              ${doc.storagePath || doc.dataUrl ? `<button class="ghost-button" data-action="preview-attachment" data-id="${escapeHtml(doc.id)}">Ouvrir</button><button class="ghost-button" data-action="download-attachment" data-id="${escapeHtml(doc.id)}">Télécharger</button>` : ""}
              ${currentUser()?.role !== "client" && can("documents") ? `<button class="ghost-button" data-action="open-modal" data-modal="clientDocument" data-id="${escapeHtml(doc.id)}">Modifier</button>` : ""}
            </div>
          </article>
        `;
      }

      function buildingDocumentsModal(buildingId) {
        const building = state.buildings.find((item) => item.id === buildingId) || scopedBuildings()[0];
        if (!building) return modalShell("Documents", `<div class="empty">Lieu introuvable.</div>`);
        const docs = scopedClientDocuments()
          .filter((doc) => doc.buildingId === building.id || (!doc.buildingId && doc.clientId === building.clientId))
          .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
        return modalShell(`Documents - ${escapeHtml(building.name)}`, `
          <div class="stack">
            <div class="actions">
              ${currentUser()?.role !== "client" && can("documents") ? `<button class="primary-button" data-action="open-modal" data-modal="clientDocument" data-building="${escapeHtml(building.id)}" data-client="${escapeHtml(building.clientId)}">Ajouter un document</button>` : ""}
            </div>
            <div class="cards-list">
              ${docs.map((doc) => clientDocumentItem(doc)).join("") || `<div class="empty">Aucun document pour ce lieu.</div>`}
            </div>
          </div>
        `, "modal-card-wide");
      }

      function attachmentItem(file) {
        const order = state.workOrders.find((item) => item.id === file.workOrderId);
        const apartment = state.apartments.find((item) => item.id === file.sourceApartmentId || item.id === file.apartmentId);
        const building = state.buildings.find((item) => item.id === file.sourceBuildingId || item.id === apartment?.buildingId);
        const canPreview = Boolean(file.storagePath || file.dataUrl);
        return `
          <article class="list-item">
            <div class="actions" style="justify-content:space-between">
              <button class="attachment-open" ${canPreview ? `data-action="preview-attachment" data-hide-download="true" data-id="${file.id}"` : ""}>
                <strong>${escapeHtml(file.name)}</strong>
                <span>${attachmentTypeLabel(file)}</span>
              </button>
              <div class="actions">
                ${canPreview ? `<button class="ghost-button" data-action="preview-attachment" data-hide-download="true" data-id="${file.id}">Ouvrir</button>` : ""}
              </div>
            </div>
            <div class="meta">Origine: ${escapeHtml(order?.number || "-")} | ${formatDate(file.uploadedAt)}</div>
            <div class="meta">Appartement source: ${escapeHtml(building?.name || "-")} - Apt ${escapeHtml(apartment?.number || "-")}</div>
          </article>
        `;
      }

      function compactAttachmentItem(file) {
        return `
          <div class="mini-row attachment-mini-row" data-action="preview-attachment" data-id="${file.id}">
            <strong>${escapeHtml(file.name)}</strong>
            <span>${attachmentTypeLabel(file)} | ${formatDate(file.uploadedAt)}</span>
          </div>
        `;
      }

      function findAttachment(fileId) {
        return state.equipment.flatMap((item) => item.attachments || []).find((file) => file.id === fileId)
          || (state.clientDocuments || []).find((doc) => doc.id === fileId);
      }

      function attachmentPreviewModal(fileId) {
        const file = findAttachment(fileId);
        if (!file) return "";
        const order = state.workOrders.find((item) => item.id === file.workOrderId);
        const type = inferFileType(file);
        const name = file.name || file.fileName || "Document";
        const url = state.modal?.fileUrl || file.dataUrl || "";
        const allowDownload = state.modal?.allowDownload !== false;
        const preview = !url && file.storagePath
          ? `<div class="empty">Préparation de la prévisualisation...</div>`
          : type.startsWith("image/")
            ? `<img class="attachment-preview-image" src="${escapeHtml(url)}" alt="${escapeHtml(name)}">`
            : type === "application/pdf"
              ? `<iframe class="attachment-preview-frame" src="${escapeHtml(url)}" title="${escapeHtml(name)}"></iframe>`
              : isOfficeFile(type, name)
                ? `<div class="empty"><strong>Document Office</strong><p>La prévisualisation intégrée n'est pas disponible pour Word, Excel ou PowerPoint.</p></div>`
                : type.startsWith("video/")
                  ? `<video class="attachment-preview-video" controls src="${escapeHtml(url)}"></video>`
                  : type.startsWith("audio/")
                    ? `<audio controls src="${escapeHtml(url)}"></audio>`
                    : url
                      ? `<iframe class="attachment-preview-frame" src="${escapeHtml(url)}" title="${escapeHtml(name)}"></iframe>`
                      : `<div class="empty">Prévisualisation non disponible pour ce type de fichier.</div>`;
        return modalShell(name, `
          <div class="stack">
            <div class="meta">Origine: ${escapeHtml(order?.number || "-")} | ${formatDate(file.uploadedAt)}</div>
            <div class="attachment-preview">${preview}</div>
            <div class="actions">
              ${url && allowDownload ? `<a class="primary-button" href="${escapeHtml(url)}" download="${escapeHtml(file.fileName || name)}">Télécharger</a>` : ""}
            </div>
          </div>
        `, "modal-card-wide attachment-preview-modal");
      }

      async function openAttachmentPreview(fileId, allowDownload = true) {
        const file = findAttachment(fileId);
        if (!file) return;
        if (file.dataUrl && !file.storagePath) {
          updateUiState({ modal: { type: "attachmentPreview", fileId, allowDownload } });
          return;
        }
        updateUiState({ modal: { type: "attachmentPreview", fileId, fileUrl: "", allowDownload } });
        try {
          const result = await api.getFileUrl(fileId);
          updateUiState({ modal: { type: "attachmentPreview", fileId, fileUrl: result.url, allowDownload } });
        } catch (error) {
          updateUiState({ modal: null, toast: error.message || "Fichier non disponible." });
        }
      }

      async function downloadAttachment(fileId) {
        const file = findAttachment(fileId);
        if (!file) return;
        let url = file.dataUrl && !file.storagePath ? file.dataUrl : "";
        if (!url) {
          try {
            const result = await api.getFileUrl(fileId);
            url = result.url;
          } catch (error) {
            showToast(error.message || "Téléchargement impossible.");
            return;
          }
        }
        const link = document.createElement("a");
        link.href = url;
        link.download = file.fileName || file.name || "document";
        link.target = "_blank";
        link.rel = "noopener";
        link.click();
      }

      return {
        documentsView,
        buildingDocumentsModal,
        attachmentItem,
        compactAttachmentItem,
        attachmentPreviewModal,
        openAttachmentPreview,
        downloadAttachment,
        findAttachment
      };
    }
  };
})();
