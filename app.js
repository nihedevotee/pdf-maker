const $ = (selector) => document.querySelector(selector);
const fileInput = $('#fileInput');
const dropZone = $('#dropZone');
const pagesArea = $('#pagesArea');
const imageList = $('#imageList');
const downloadButton = $('#downloadButton');
const status = $('#status');
let pages = [];
let draggedId = null;

function addFiles(files) {
  const images = [...files].filter((file) => file.type.startsWith('image/'));
  if (!images.length) { status.textContent = 'Please choose image files.'; return; }
  pages.push(...images.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), rotation: 0 })));
  pages.sort(naturalSort); // auto-order: 1, 2, 3, ... 10, 11
  render();
  status.textContent = `${images.length} image${images.length === 1 ? '' : 's'} added and sorted.`;
}

function render() {
  imageList.innerHTML = '';
  pages.forEach((page, index) => {
    const card = document.createElement('li');
    card.className = 'page-card'; card.draggable = true; card.dataset.id = page.id;
    card.innerHTML = `<div class="thumb"><img src="${page.url}" alt="Page ${index + 1} preview" style="transform:rotate(${page.rotation}deg)${page.rotation % 180 ? ' scale(.7)' : ''}"></div><div class="card-meta"><span class="page-number">${index + 1}</span><span class="filename" title="${page.file.name}">${page.file.name}</span></div><button class="rotate" type="button" aria-label="Rotate ${page.file.name}">↻</button><button class="remove" type="button" aria-label="Remove ${page.file.name}">×</button>`;
    card.addEventListener('dragstart', () => { draggedId = page.id; card.classList.add('drag-source'); });
    card.addEventListener('dragend', () => { draggedId = null; document.querySelectorAll('.page-card').forEach(c => c.classList.remove('drag-source', 'drag-over')); });
    card.addEventListener('dragover', (event) => { event.preventDefault(); if (draggedId !== page.id) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (event) => { event.preventDefault(); movePage(draggedId, page.id); });
    card.querySelector('.remove').addEventListener('click', () => removePage(page.id));
    card.querySelector('.rotate').addEventListener('click', (e) => { e.stopPropagation(); page.rotation = (page.rotation + 90) % 360; render(); });
    imageList.append(card);
  });
  $('#pageCount').textContent = `${pages.length} page${pages.length === 1 ? '' : 's'}`;
  pagesArea.hidden = pages.length === 0; dropZone.hidden = pages.length > 0; downloadButton.disabled = pages.length === 0;
}

function movePage(fromId, toId) { const from = pages.findIndex(p => p.id === fromId); const to = pages.findIndex(p => p.id === toId); if (from < 0 || to < 0 || from === to) return; pages.splice(to, 0, pages.splice(from, 1)[0]); render(); }
function removePage(id) { const page = pages.find(p => p.id === id); URL.revokeObjectURL(page.url); pages = pages.filter(p => p.id !== id); render(); }
function naturalSort(a, b) { return a.file.name.localeCompare(b.file.name, undefined, { numeric:true, sensitivity:'base' }); }

async function imageData(file, quality, rotation = 0) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (!quality && !rotation) { resolve({ img, format: pdfImageFormat(file) }); return; }
        const turn = rotation % 180 !== 0;
        const canvas = document.createElement('canvas');
        canvas.width = turn ? img.naturalHeight : img.naturalWidth;
        canvas.height = turn ? img.naturalWidth : img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        const out = new Image();
        out.onload = () => resolve({ img: out, format: 'JPEG' });
        out.onerror = reject;
        out.src = canvas.toDataURL('image/jpeg', quality || 0.92);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function pdfImageFormat(file) {
  if (file.type === 'image/png') return 'PNG';
  if (file.type === 'image/webp') return 'WEBP';
  return 'JPEG';
}
async function makePdf() {
  if (!pages.length || !window.jspdf) { status.textContent = 'PDF library could not load. Check your internet connection and try again.'; return; }
  const compress = confirm('Compress the PDF to reduce file size? (Slightly lowers image quality)');
  downloadButton.disabled = true; status.textContent = compress ? 'Compressing and building your PDF…' : 'Building your PDF…';
  try {
    const { jsPDF } = window.jspdf; const format = $('#pageSize').value; const orientation = $('#orientation').value;
    const pdf = new jsPDF({ orientation, unit:'mm', format, compress:true }); const fit = $('#fit').value;
    const quality = compress ? 0.6 : null;
    const orderedPages = $('#reversePdf').checked ? [...pages].reverse() : pages;
    for (let i = 0; i < orderedPages.length; i++) {
      if (i) pdf.addPage(format, orientation);
      const { img, format: imgFormat } = await imageData(orderedPages[i].file, quality, orderedPages[i].rotation);
      const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
      const ratio = fit === 'cover' ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * ratio, ih = img.naturalHeight * ratio;
      pdf.addImage(img, imgFormat, (w - iw) / 2, (h - ih) / 2, iw, ih, undefined, 'FAST');
    }
    pdf.save('image-order.pdf'); status.textContent = `Done — ${orderedPages.length} pages downloaded${$('#reversePdf').checked ? ' in reverse order' : ' in your chosen order'}.`;
  } catch (error) { console.error(error); status.textContent = 'Something went wrong while making the PDF. Please try again.'; }
  finally { downloadButton.disabled = false; }
}

$('#browseButton').addEventListener('click', (event) => { event.stopPropagation(); fileInput.click(); });
$('#addMoreButton').addEventListener('click', () => fileInput.click()); fileInput.addEventListener('change', (event) => { addFiles(event.target.files); fileInput.value = ''; });
dropZone.addEventListener('click', () => fileInput.click()); dropZone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.click(); });
['dragenter','dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave','drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
$('#sortButton').addEventListener('click', () => { pages.sort(naturalSort); render(); status.textContent = 'Pages sorted by filename.'; });
$('#reverseButton').addEventListener('click', () => { pages.reverse(); render(); status.textContent = 'Page order reversed — last image is now first.'; });
$('#clearButton').addEventListener('click', () => { pages.forEach(page => URL.revokeObjectURL(page.url)); pages = []; render(); status.textContent = 'All images cleared.'; });
downloadButton.addEventListener('click', makePdf);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Re-encodes embedded JPEG images at a lower quality so "compress" actually
// shrinks the file, not just the internal PDF structure. Non-JPEG image
// streams (e.g. raw PNG data) are left untouched.
async function recompressPdfImages(pdfDoc, quality, maxDimension) {
  const { PDFName, PDFRawStream } = window.PDFLib;
  let count = 0;
  for (const page of pdfDoc.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const xObjects = resources.lookup(PDFName.of('XObject'));
    if (!xObjects || typeof xObjects.entries !== 'function') continue;
    for (const [name, ref] of xObjects.entries()) {
      let xObject;
      try { xObject = pdfDoc.context.lookup(ref); } catch { continue; }
      if (!(xObject instanceof PDFRawStream)) continue;
      const subtype = xObject.dict.get(PDFName.of('Subtype'));
      if (!subtype || subtype.toString() !== '/Image') continue;
      const filter = xObject.dict.get(PDFName.of('Filter'));
      if (!filter || !filter.toString().includes('/DCTDecode')) continue; // only re-encode JPEGs
      try {
        const originalBytes = xObject.getContents();
        const bitmap = await createImageBitmap(new Blob([originalBytes], { type: 'image/jpeg' }));
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const newBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        const newBytes = new Uint8Array(await newBlob.arrayBuffer());
        if (newBytes.length < originalBytes.length) {
          const embedded = await pdfDoc.embedJpg(newBytes);
          xObjects.set(name, embedded.ref);
          pdfDoc.context.delete(ref); // drop the old, larger image data so it isn't saved too
          count++;
        }
      } catch (imgError) {
        console.warn('Skipped an image during compression:', imgError);
      }
    }
  }
  return count;
}

const pdfInput = $('#pdfInput');
const choosePdfButton = $('#choosePdfButton');
const pdfFileName = $('#pdfFileName');
const reversePdfFileButton = $('#reversePdfFileButton');
const pdfStatus = $('#pdfStatus');
let selectedPdfFile = null;

choosePdfButton.addEventListener('click', () => pdfInput.click());
pdfInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  selectedPdfFile = file;
  pdfFileName.textContent = file.name;
  reversePdfFileButton.disabled = false;
  pdfStatus.textContent = '';
});

reversePdfFileButton.addEventListener('click', async () => {
  if (!selectedPdfFile || !window.PDFLib) { pdfStatus.textContent = 'PDF library could not load. Check your internet connection and try again.'; return; }
  const compress = confirm('Compress the PDF to reduce file size? (Shrinks oversized photos and re-encodes them at lower quality — page layout and text are untouched)');
  reversePdfFileButton.disabled = true; pdfStatus.textContent = compress ? 'Reversing your PDF…' : 'Reversing your PDF…';
  try {
    const { PDFDocument } = window.PDFLib;
    const bytes = await selectedPdfFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(bytes);
    const newDoc = await PDFDocument.create();
    const pageCount = srcDoc.getPageCount();
    const reversedIndices = [...Array(pageCount).keys()].reverse();
    const copiedPages = await newDoc.copyPages(srcDoc, reversedIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));
    let imagesCompressed = 0;
    if (compress) {
      pdfStatus.textContent = 'Compressing images…';
      imagesCompressed = await recompressPdfImages(newDoc, 0.4, 1600);
    }
    const outBytes = await newDoc.save({ useObjectStreams: true });
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${selectedPdfFile.name.replace(/\.pdf$/i, '')}-reversed.pdf`;
    document.body.append(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
    const sizeNote = compress
      ? (imagesCompressed
          ? ` — ${imagesCompressed} image${imagesCompressed === 1 ? '' : 's'} compressed (${formatBytes(bytes.byteLength)} → ${formatBytes(outBytes.byteLength)})`
          : ' — no compressible (JPEG) images found, saved as-is')
      : '';
    pdfStatus.textContent = `Done — ${pageCount} pages reversed and downloaded${sizeNote}.`;
  } catch (error) {
    console.error(error);
    pdfStatus.textContent = 'Something went wrong while reversing the PDF. Please try again.';
  } finally {
    reversePdfFileButton.disabled = false;
  }
});

// ---------- Merge PDFs ----------
const mergeDrop = $('#mergeDrop');
const mergeFileInput = $('#mergeFileInput');
const mergeFolderInput = $('#mergeFolderInput');
const mergeList = $('#mergeList');
const mergeButton = $('#mergeButton');
const mergeStatus = $('#mergeStatus');
let mergeItems = [];
let mergeDragId = null;

const pathSort = (a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

function addMergeEntries(entries) {
  const pdfs = entries.filter((e) => isPdf(e.file));
  if (!pdfs.length) { mergeStatus.textContent = 'No PDFs found.'; return; }
  for (const e of pdfs) mergeItems.push({ id: crypto.randomUUID(), file: e.file, path: e.path });
  mergeItems.sort(pathSort);
  renderMerge();
  mergeStatus.textContent = `${pdfs.length} PDF${pdfs.length === 1 ? '' : 's'} added and sorted.`;
}

function addMergeFromInput(files) {
  addMergeEntries([...files].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
}

async function readEntry(entry, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, path: entry.fullPath.replace(/^\//, '') });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch;
    do { // readEntries returns ~100 at a time, so loop until empty
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const child of batch) await readEntry(child, out);
    } while (batch.length);
  }
}

async function addMergeFromDrop(dataTransfer) {
  // grab entries synchronously, the items go stale after the first await
  const entries = [...dataTransfer.items].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) { addMergeFromInput(dataTransfer.files); return; }
  mergeStatus.textContent = 'Reading folders…';
  const out = [];
  for (const entry of entries) await readEntry(entry, out);
  addMergeEntries(out);
}

function renderMerge() {
  mergeList.innerHTML = '';
  const frag = document.createDocumentFragment();
  mergeItems.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'merge-row'; li.draggable = true; li.dataset.id = item.id;
    li.innerHTML = `<span class="merge-num">${i + 1}</span><span class="merge-path"></span><span class="merge-size">${formatBytes(item.file.size)}</span><button class="merge-remove" type="button" aria-label="Remove">×</button>`;
    li.querySelector('.merge-path').textContent = item.path;
    li.querySelector('.merge-path').title = item.path;
    frag.append(li);
  });
  mergeList.append(frag);
  $('#mergeCount').textContent = `${mergeItems.length} PDF${mergeItems.length === 1 ? '' : 's'}`;
  $('#mergeArea').hidden = mergeItems.length === 0;
  mergeDrop.hidden = mergeItems.length > 0;
  mergeButton.disabled = mergeItems.length === 0;
}

// row events (delegated so thousands of rows stay fast)
mergeList.addEventListener('dragstart', (e) => {
  const row = e.target.closest('.merge-row'); if (!row) return;
  mergeDragId = row.dataset.id; row.classList.add('drag-source');
});
mergeList.addEventListener('dragend', () => {
  mergeDragId = null;
  mergeList.querySelectorAll('.drag-source, .drag-over').forEach((r) => r.classList.remove('drag-source', 'drag-over'));
});
mergeList.addEventListener('dragover', (e) => {
  const row = e.target.closest('.merge-row'); if (!row) return;
  e.preventDefault();
  mergeList.querySelectorAll('.drag-over').forEach((r) => r.classList.remove('drag-over'));
  if (row.dataset.id !== mergeDragId) row.classList.add('drag-over');
});
mergeList.addEventListener('drop', (e) => {
  const row = e.target.closest('.merge-row'); if (!row || !mergeDragId) return;
  e.preventDefault();
  const from = mergeItems.findIndex((p) => p.id === mergeDragId);
  const to = mergeItems.findIndex((p) => p.id === row.dataset.id);
  if (from < 0 || to < 0 || from === to) return;
  mergeItems.splice(to, 0, mergeItems.splice(from, 1)[0]);
  renderMerge();
});
mergeList.addEventListener('click', (e) => {
  const btn = e.target.closest('.merge-remove'); if (!btn) return;
  const id = btn.closest('.merge-row').dataset.id;
  mergeItems = mergeItems.filter((p) => p.id !== id);
  renderMerge();
});

// inputs + buttons
$('#mergeBrowseFiles').addEventListener('click', (e) => { e.stopPropagation(); mergeFileInput.click(); });
$('#mergeBrowseFolder').addEventListener('click', (e) => { e.stopPropagation(); mergeFolderInput.click(); });
$('#mergeAddFiles').addEventListener('click', () => mergeFileInput.click());
$('#mergeAddFolder').addEventListener('click', () => mergeFolderInput.click());
mergeFileInput.addEventListener('change', (e) => { addMergeFromInput(e.target.files); mergeFileInput.value = ''; });
mergeFolderInput.addEventListener('change', (e) => { addMergeFromInput(e.target.files); mergeFolderInput.value = ''; });
mergeDrop.addEventListener('click', () => mergeFileInput.click());
mergeDrop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') mergeFileInput.click(); });
['dragenter', 'dragover'].forEach((t) => mergeDrop.addEventListener(t, (e) => { e.preventDefault(); mergeDrop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((t) => mergeDrop.addEventListener(t, (e) => { e.preventDefault(); mergeDrop.classList.remove('dragging'); }));
mergeDrop.addEventListener('drop', (e) => addMergeFromDrop(e.dataTransfer));
$('#mergeSort').addEventListener('click', () => { mergeItems.sort(pathSort); renderMerge(); mergeStatus.textContent = 'Sorted by path.'; });
$('#mergeReverse').addEventListener('click', () => { mergeItems.reverse(); renderMerge(); mergeStatus.textContent = 'Order reversed.'; });
$('#mergeClear').addEventListener('click', () => { mergeItems = []; renderMerge(); mergeStatus.textContent = 'All PDFs cleared.'; });

// cover page
async function addCoverPage(doc, title) {
  const { StandardFonts, rgb } = window.PDFLib;
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, maxW = W - 120;
  const page = doc.addPage([W, H]);
  const wrap = (s) => {
    const lines = []; let line = '';
    for (const word of title.split(/\s+/)) {
      const t = line ? line + ' ' + word : word;
      if (!line || font.widthOfTextAtSize(t, s) <= maxW) line = t;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
    return lines;
  };
  let size = 56, lines = wrap(size);
  while (lines.some((l) => font.widthOfTextAtSize(l, size) > maxW) && size > 16) { size -= 2; lines = wrap(size); }
  const lh = size * 1.25;
  let y = H / 2 + (lines.length * lh) / 2 - size;
  for (const l of lines) {
    page.drawText(l, { x: (W - font.widthOfTextAtSize(l, size)) / 2, y, size, font, color: rgb(0, 0, 0) });
    y -= lh;
  }
}

// merge
mergeButton.addEventListener('click', async () => {
  if (!mergeItems.length || !window.PDFLib) { mergeStatus.textContent = 'PDF library could not load. Check your internet connection and try again.'; return; }
  mergeButton.disabled = true;
  const { PDFDocument } = window.PDFLib;
  const failed = [];
  let pageTotal = 0;
  try {
    const out = await PDFDocument.create();
    const coverTitle = $('#mergeTitle').value.trim();
    if (coverTitle) { await addCoverPage(out, coverTitle); pageTotal++; }
    for (let i = 0; i < mergeItems.length; i++) {
      mergeStatus.textContent = `Merging ${i + 1} / ${mergeItems.length}…`;
      try {
        const src = await PDFDocument.load(await mergeItems[i].file.arrayBuffer(), { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
        pageTotal += copied.length;
      } catch (err) {
        console.warn('Skipped', mergeItems[i].path, err);
        failed.push(mergeItems[i].path);
      }
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0)); // let the UI repaint
    }
    mergeStatus.textContent = 'Saving…';
    const bytes = await out.save({ useObjectStreams: true });
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'merged.pdf';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    mergeStatus.textContent = `Done — ${mergeItems.length - failed.length} PDFs, ${pageTotal} pages merged (${formatBytes(bytes.byteLength)})` + (failed.length ? `. Skipped ${failed.length} unreadable: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}` : '.');
  } catch (error) {
    console.error(error);
    mergeStatus.textContent = 'Something went wrong while merging. Try fewer files at once.';
  } finally {
    mergeButton.disabled = mergeItems.length === 0;
  }
});