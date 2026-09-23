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
  pages.push(...images.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })));
  pages.sort(naturalSort); // auto-order: 1, 2, 3, ... 10, 11
  render();
  status.textContent = `${images.length} image${images.length === 1 ? '' : 's'} added and sorted.`;
}

function render() {
  imageList.innerHTML = '';
  pages.forEach((page, index) => {
    const card = document.createElement('li');
    card.className = 'page-card'; card.draggable = true; card.dataset.id = page.id;
    card.innerHTML = `<div class="thumb"><img src="${page.url}" alt="Page ${index + 1} preview"></div><div class="card-meta"><span class="page-number">${index + 1}</span><span class="filename" title="${page.file.name}">${page.file.name}</span></div><button class="remove" type="button" aria-label="Remove ${page.file.name}">×</button>`;
    card.addEventListener('dragstart', () => { draggedId = page.id; card.classList.add('drag-source'); });
    card.addEventListener('dragend', () => { draggedId = null; document.querySelectorAll('.page-card').forEach(c => c.classList.remove('drag-source', 'drag-over')); });
    card.addEventListener('dragover', (event) => { event.preventDefault(); if (draggedId !== page.id) card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (event) => { event.preventDefault(); movePage(draggedId, page.id); });
    card.querySelector('.remove').addEventListener('click', () => removePage(page.id));
    imageList.append(card);
  });
  $('#pageCount').textContent = `${pages.length} page${pages.length === 1 ? '' : 's'}`;
  pagesArea.hidden = pages.length === 0; dropZone.hidden = pages.length > 0; downloadButton.disabled = pages.length === 0;
}

function movePage(fromId, toId) { const from = pages.findIndex(p => p.id === fromId); const to = pages.findIndex(p => p.id === toId); if (from < 0 || to < 0 || from === to) return; pages.splice(to, 0, pages.splice(from, 1)[0]); render(); }
function removePage(id) { const page = pages.find(p => p.id === id); URL.revokeObjectURL(page.url); pages = pages.filter(p => p.id !== id); render(); }
function naturalSort(a, b) { return a.file.name.localeCompare(b.file.name, undefined, { numeric:true, sensitivity:'base' }); }

async function imageData(file, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (!quality) { resolve({ img, format: pdfImageFormat(file) }); return; }
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const compressed = new Image();
        compressed.onload = () => resolve({ img: compressed, format: 'JPEG' });
        compressed.onerror = reject;
        compressed.src = canvas.toDataURL('image/jpeg', quality);
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
    for (let i = 0; i < pages.length; i++) {
      if (i) pdf.addPage(format, orientation);
      const { img, format: imgFormat } = await imageData(pages[i].file, quality);
      const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
      const ratio = fit === 'cover' ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * ratio, ih = img.naturalHeight * ratio;
      pdf.addImage(img, imgFormat, (w - iw) / 2, (h - ih) / 2, iw, ih, undefined, 'FAST');
    }
    pdf.save('image-order.pdf'); status.textContent = `Done — ${pages.length} pages downloaded in your chosen order.`;
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