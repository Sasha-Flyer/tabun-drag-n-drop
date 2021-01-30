// ==UserScript==
// @name         Tabun Image Drag&Drop
// @include      https://tabun.everypony.*
// @version      0.1.1
// @description  upload images by Drag&Dropping them
// @author       Sasha-Flyer
// @updateURL    https://gist.githubusercontent.com/Sasha-Flyer/b003d0c032b47428f1de10a0e5460a02/raw/TabunDragnDropImages.js
// @downloadURL  https://gist.githubusercontent.com/Sasha-Flyer/b003d0c032b47428f1de10a0e5460a02/raw/TabunDragnDropImages.js
// ==/UserScript==

/**
 * Returns LS security key
 */
const getTabunKey = () => {
  const link = document.querySelector('li.item-signout a');
  const href = link && link.href || '';
  const query = href.split('?')[1] || '';
  const key = query.split('=')[1] || '';
  return key;
}

const sendImageToTabun = async (form) => {
  form.append('title', '');
  form.append('security_ls_key', getTabunKey());

  const res = await fetch(location.origin + '/ajax/upload/image/', {
    method: 'POST',
    body: form
  });

  const text = await res.text();

  const json = JSON.parse(new DOMParser().parseFromString(text, 'text/html').querySelector('textarea').textContent);
  return json
}

async function dropHandler(ev) {
  const autoNameSpoilers = ev.altKey;
  const separateSpoilers = ev.shiftKey;
  const loadPreview = ev.ctrlKey;
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
  let names = [];
  if (ev.dataTransfer.items) {
    let fullSize = 0;
    let iterFile = 0;
    let forms = Array.prototype.slice.call(ev.dataTransfer.files).map(async (file) => {
      const form = new FormData();
      names.push(file.name.split('.')[0]);
      let previewForm;
      if (loadPreview) {
        const p = new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function (readerEvent) {
            var image = new Image();
            image.onload = function (imageEvent) {

              // Resize the image
              var canvas = document.createElement('canvas'),
                max_size = 70,// TODO : pull max size from a site config
                width = image.width,
                height = image.height;
              form.width = width;
              if (width > height) {
                if (width > max_size) {
                  height *= max_size / width;
                  width = max_size;
                }
              } else {
                if (height > max_size) {
                  width *= max_size / height;
                  height = max_size;
                }
              }
              canvas.width = width;
              canvas.height = height;
              canvas.getContext('2d').drawImage(image, 0, 0, width, height);
              var dataUrl = canvas.toDataURL('image/png');
              var resizedImage = dataURLToBlob(dataUrl);
              resolve(resizedImage);
            }
            image.src = readerEvent.target.result;
          }
          reader.readAsDataURL(file);


        });
        const preview = await p;
        preview.lastModified = new Date();
        preview.name = "preview.png";
        previewForm = new FormData();
        previewForm.append('img_file', preview);
        previewForm.iterFile = iterFile;
      }
      fullSize += file.size;
      iterFile += 1;
      form.append('img_file', file);
      form.iterFile = iterFile;
      return { form, previewForm };
    });
    forms = await Promise.all(forms);
    let spoilerName = '';
    let previewForms;
    if (loadPreview) previewForms = await multiplePaste(forms, true);
    if (loadPreview && !separateSpoilers) {
      const square = Math.ceil(previewForms.length ** 0.5);
      let currentRowCount = 0;
      for (let form of previewForms) {
        currentRowCount += 1;
        spoilerName += form;
        if (currentRowCount === square) {
          currentRowCount = 0;
          spoilerName += '\n';
        }
      }
      spoilerName += '\n';
    }
    autoNameSpoilers && !separateSpoilers ? spoilerName += names.toString().split(',').join(" ") : !separateSpoilers ? spoilerName += prompt("Введите название спойлера") : '';
    let currentTemplate = 0;
    if (!separateSpoilers) textPlace.value += `\n<span class="spoiler"><span class="spoiler-title">${spoilerName}</span><span class="spoiler-body">`;
    const wide = document.getElementById("widemode");
    const saved = wide.outerHTML;
    multiplePaste(forms).then(async (templatesArray) => {
      for (const template of templatesArray) {
        console.log(template);
        let imageTemplate = '';
        if (separateSpoilers) {
          imageTemplate += `<span class="spoiler"><span class="spoiler-title">\n`;
          loadPreview ? imageTemplate += previewForms[currentTemplate] : '';
          if (autoNameSpoilers) imageTemplate += names[currentTemplate];
          else {
            window.innerWidth > forms[currentTemplate].form.width ? wide.innerHTML = template : wide.innerHTML = template.replace("/>", `width="${window.innerWidth}" >`);

            await new Promise(function (resolve, reject) {
              wide.children[0].onload = () => {
                setTimeout(() => { // некоторые браузеры оставляют белый экран даже после onload
                  imageTemplate += prompt(`Введите название спойлера для ${names[currentTemplate]}`);
                  resolve();
                }, 100);
              }
            });
          }
          currentTemplate += 1;
          imageTemplate += '\n</span>\n';
          imageTemplate += '<span class="spoiler-body">\n';
        }
        textPlace.value = textPlace.value + imageTemplate + template + '\n';
        if (separateSpoilers) textPlace.value += '</span></span> \n';
      };
      if (separateSpoilers && !autoNameSpoilers) wide.outerHTML = saved;
      if (!separateSpoilers) textPlace.value += '</span></span> \n';

      if (topicPlace) topicPlace.value += ` [Вес поста: ${fullSize < 1000 ? fullSize + " байт" :
        fullSize < 1000000 ? (fullSize/1000).toFixed(1) + " КБ" : (fullSize/1000000).toFixed(1) + " МБ"}]`;
    });
  }
}

const multiplePaste = async (ev, previews = false) => (await Promise.all(ev.map(image => sendImageToTabun(previews ? image.previewForm : image.form)))).map(res => res.sText || '');


let textPlace = document.getElementById("form_comment_text");
let topicPlace;
if (!textPlace) {
  textPlace = document.getElementById("topic_text");
  topicPlace = document.getElementById("topic_title");
}

textPlace.ondrop = dropHandler;

const dataURLToBlob = function(dataURL) {
  const BASE64_MARKER = ';base64,';
  if (dataURL.indexOf(BASE64_MARKER) === -1) {
    const parts = dataURL.split(',');
    const contentType = parts[0].split(':')[1];
    const raw = parts[1];

    return new Blob([raw], {type: contentType});
  }

  const parts = dataURL.split(BASE64_MARKER);
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;

  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], {type: contentType});
}
