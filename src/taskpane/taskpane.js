const cookieManager = require('../../../framework/cookieManager');
// const dialogHtml = require('./dialog.html');
let businessId;
let fpType;
let dialog;
let connection;
let urls = {
  'ui': '/ocweb/rest',
  'all': '/form-paragraphs?aia=#aia#',
  'subjects': '/form-paragraph-subjects?aia=#aia#',
  'categories': '/form-paragraph-categories?aia=#aia#',
  'custom': '/custom-paragraphs?aia=#aia#&contentRtf=false',
  'paragraph-text' : '/form-paragraphs/#id#/html-content',
  'examiner-note': '/form-paragraphs/#id#/html-examiner-note',
  'docContent': '/documents/#docId#/content/base64',
  'saveData': '/documents/#docId#/content/word?lastModifedDate=1234542&documentSetId=#docSetId#'
};
let baseUrl = `${window.location.protocol}//${window.location.host}`;
let contentLoaded = false;
const aia = true;
let docId = 206810;
let docSetId = 112449407; // TODO: get the actual value
Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    //setCookies();
    bindListeners();
    fpType = 'subjects';
    clearTextAreas();
    buildFormParagraphTree();    
    loadContent();
    setCustomProps();
    // initializeSignalR();
    document.getElementById("sideload-msg").style.display = "none";
    document.getElementById("app-body").style.display = "flex";
    // Listen for the document save event
    // document.addHandlerAsync(Office.EventType.DocumentSaved, onDocumentSaved);
    // Word.run(async (context) => {
    //   context.document.addHandlerAsync(Office.EventType.DocumentSaved, onDocumentSaved);
    //   await context.sync();
    // }).catch((error) => {
    //     console.error("Error setting up event listener:", error);
    // });
  }
});

function initializeSignalR() {
  connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5050') // Replace with your SignalR hub URL
      .configureLogging(signalR.LogLevel.Information)
      .build();

  connection.start()
      .then(() => console.log("Connected to SignalR hub"))
      .catch(err => console.error(err.toString()));

  // Optional: Handle incoming messages
  connection.on("ReceiveMessage", function (message) {
      console.log("Received message: " + message);
      // Handle the message (e.g., display it in the add-in)
  });
}

function sendMessage(message) {
  if (connection) {
      connection.invoke("SendMessage", message) // Call the SendMessage method on the server
          .then(() => console.log("Message sent: " + message))
          .catch(err => console.error(err.toString()));
  } else {
      console.error("SignalR connection is not established.");
  }
}

async function saveFunction(event) {
  // New Save button in ribbon calls this function  
  urls = {
    'ui': '/ocweb/rest',
    'all': '/form-paragraphs?aia=#aia#',
    'subjects': '/form-paragraph-subjects?aia=#aia#',
    'categories': '/form-paragraph-categories?aia=#aia#',
    'custom': '/custom-paragraphs?aia=#aia#&contentRtf=false',
    'paragraph-text' : '/form-paragraphs/#id#/html-content',
    'examiner-note': '/form-paragraphs/#id#/html-examiner-note',
    'docContent': '/documents/#docId#/content/base64',
    'saveData': '/documents/#docId#/content/word?lastModifedDate=1234542&documentSetId=#docSetId#'
  };
  baseUrl = `${window.location.protocol}//${window.location.host}`;
  docId = await getCustomProperty('docId');
  docSetId = await getCustomProperty('docSetId');
  await saveDocumentAsPdfAndSend();
  event.completed();
}

function setCustomProps() {
  createCustomProperty('docId', docId);
  createCustomProperty('docSetId', docSetId);
  createCustomProperty('AIA', aia);
}

function clearTextAreas() {
  document.getElementById("paragraph-text").innerHTML = "";
  document.getElementById("examiner-note").innerHTML = "";
  document.getElementById("insert-paragraph").disabled = true;
}

function generateUrl(url, params) {
  return baseUrl.replace('https://localhost:3000', 'http://localhost:5002') + 
    urls['ui'] + replaceParams(urls[url], params);
};

function replaceParams (url, params) {
  for (var key in params) {
      if (params.hasOwnProperty(key)) {
          url = url.replace('#' + key + '#', params[key]);
      }
  }
  return url;
};

function setCookies() {
  cookieManager.create('pe2e.current.employeeNumber', 76665, 10080);
  cookieManager.create('Bearer', '"wX6tm55nAegBoeqirMxAyMEbxYZXFQ3SuG9zL5VtK4xmx88="', 10080);
  cookieManager.create('Bearer_Login', 'kjolley', 10080);
  cookieManager.create('_ga_6DW9BYCGVB', 'GS1.1.1722889599.123.0.1722889599.0.0.0', 10080);
  cookieManager.create('_ga_CSLL4ZEK4L', 'GS1.1.1722875649.1.1.1722875698.0.0.0', 10080);
  cookieManager.create('_ga', 'GA1.1.1498214676.1713905079', 10080);
  cookieManager.create('_ga_CD30TTEK1F', 'GS1.1.1722875649.1.1.1722875698.0.0.0', 10080);
  cookieManager.create('apt.uid', 'AP-YFGMCGUNNIFB-2-1718219202044-74563969.0.2.09791a20-1dc4-4ebd-a022-6b8c10761fc2', 10080);
}

function bindListeners() {
  document.getElementById("insert-paragraph").onclick = () => tryCatch(insertParagraph);
  document.getElementById("save-data").onclick = () => saveDocumentAsPdfAndSend();
  const elements = document.getElementsByClassName('fptab');
  Array.from(elements).forEach(element => {
      element.onclick = (event) => {
          Array.from(elements).forEach(el => {
              el.classList.remove('active');
          });
          event.currentTarget.classList.add('active');
          fpType = event.currentTarget.dataset.type;
          document.getElementById('accordion').innerHTML = '';
          clearTextAreas();
          buildFormParagraphTree();
      };
  });
}

async function loadContent() {
  contentLoaded = await getCustomProperty('contentLoaded') || false; 
  if (!contentLoaded) {
    try {
      let url = generateUrl('docContent', {docId: docId});
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json', 
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok ' + response.statusText);
      }
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json(); 
        loadContent();
      } else {
          data = await response.text();
          await Word.run(async (context) => {
            const range = context.document.getSelection();
            range.insertFileFromBase64(data, Word.InsertLocation.end);            
            await context.sync();
            createCustomProperty('contentLoaded', true);
          });
      }
      
    } catch (error) {
      console.error(error);
    }
  }
}

async function buildFormParagraphTree() {
  try {
    let url = generateUrl(fpType, {aia: aia.toString()})
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json', 
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok ' + response.statusText);
    }
    const data = await response.json();
    if (data.businessResponse.errorList) {
      console.log(data.businessResponse.errorList[0].message)
    } else {
      if (fpType === 'all') {
        buildTree(data.businessResponse.formParagraphList);
      } else if (fpType === 'subjects') {
        createAccordion(data.businessResponse.subjectList, document.getElementById('accordion'));
      } else if (fpType === 'categories') {
        createAccordion(data.businessResponse, document.getElementById('accordion'));
      } else if (fpType === 'custom') {
        buildCustomTree(data.businessResponse);
      }    
    }
  } catch (error) {
    console.error('Error fetching paragraph:', error);
  }
}

function buildTree(data) {
  const map = {};
  const tree = [];

  data.forEach(item => {
    map[item.id] = { ...item, children: [] };
  });
  data.forEach(item => {
    if (item.relatedFormParagraphId) {
      const parent = map[item.relatedFormParagraphId];
      if (parent) {
        parent.children.push(map[item.id]);
      }
    } else {
      tree.push(map[item.id]);
    }
  });
  createAccordion(tree, document.getElementById('accordion'))
}

function buildCustomTree(data) {
    const map = {};
    const tree = [];
    
    data.forEach(item => {
      map[item.id] = { ...item, children: [] };
    });
    data.forEach(item => {
      let parentNode = tree.find(node => node.title === item.folderTitle);
      if (!parentNode) {
        parentNode = { title: item.folderTitle, children: [] };
        tree.push(parentNode);
      }
      parentNode.children.push(map[item.id]);
    });
    createAccordion(tree, document.getElementById('accordion'));
}

function createAccordion(data, parentElement) {
  data.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('accordion-item');

      const header = document.createElement('div');
      header.classList.add('accordion-header');
      if (item.paragraphs && item.paragraphs.length > 0) {
        header.id = item.paragraphs[0].id;
        header.title = item.paragraphs[0].businessId;
      } else if (item.formParagraphs && item.formParagraphs.length > 0) {
        header.id = item.formParagraphs[0].id;
        header.title = item.formParagraphs[0].businessId;
      } else {
        header.id = item.id;
        header.title = item.businessId || item.title;
      }
      header.onclick = function(event) {
        event.stopPropagation();
        let id = event.currentTarget.id;
        businessId = event.currentTarget.title;
        populateParagraphText(id, 'paragraph-text');
        populateParagraphText(id, 'examiner-note');     
      };

      if (item.childSubjects) {
        item.children = item.childSubjects;
      }

      if (item.children && item.children.length > 0) {
          const toggleButton = document.createElement('button');
          toggleButton.classList.add('toggle-button');
          toggleButton.textContent = '+';
          toggleButton.onclick = function(event) {
              event.stopPropagation();
              const content = this.parentElement.nextElementSibling;
              if (content.style.display === "block") {
                  content.style.display = "none";
                  this.textContent = '+';
              } else {
                  content.style.display = "block";
                  this.textContent = '-';
              }
          };

          header.appendChild(toggleButton); 
      }

      const title = document.createElement('span');
      if (fpType !== 'categories') {
        title.textContent = item.title;
      } else {
        title.textContent = item.name;
      }      
      header.appendChild(title);

      const content = document.createElement('div');
      content.classList.add('accordion-content');
      if (item.children && item.children.length > 0) {
          createAccordion(item.children, content);
      } else {
          content.textContent = "No children available";
      }

      itemDiv.appendChild(header);
      itemDiv.appendChild(content);
      parentElement.appendChild(itemDiv);
  });
}

async function populateParagraphText(id, area) {
  var element = document.getElementById(area);
  element.innerHTML = "";
  try {
    let url = generateUrl(area, {id: id});
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    element.innerHTML = data;
    if (area === 'paragraph-text'){
      document.getElementById("insert-paragraph").disabled = false;
    } 
  } catch (error) {
      if (area === 'paragraph-text'){
        document.getElementById("insert-paragraph").disabled = true;
      }        
      console.error('Error fetching paragraph text:', error);
      return null;
  }
}

async function insertParagraph() {  
  const paragraphData = document.getElementById("paragraph-text").innerText;
  await Word.run(async (context) => {
    const paragraphs = paragraphData.split('\n');  

    for (const paragraph of paragraphs) {
      if (paragraph !== '') {
        const range = context.document.getSelection();
        const insertedParagraph = range.insertParagraph(paragraph.replaceAll('\n', ''), Word.InsertLocation.after);
        insertedParagraph.getRange().select();
        const bookmarkRange = insertedParagraph.getRange();
        bookmarkRange.insertBookmark('FP_' + businessId.replaceAll('-', '_'));

        await context.sync();      
      }
    }

    await context.sync();
    showDialog('Success', businessId + ' inserted!');
  });
}

function showDialog(title, message) {
  if (dialog) {
    dialog.close();
    setTimeout(() => {
      createNewDialog(title, message);
    }, 1000);
  } else {
    createNewDialog(title, message);
  }
}

function createNewDialog(title, message) {
  Office.context.ui.displayDialogAsync('https://localhost:3000/dialog.html', { height: 30, width: 20 }, (asyncResult) => {
    dialog = asyncResult.value;
    dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => processMessage(arg, title, message));    
  });
}

function processMessage(arg, title, message) {
  const messageData = JSON.parse(arg.message);
  if (messageData.messageType === "dialogClosed") {
    dialog.close();
  } else if (messageData.messageType === "dialogReady") {
    const messageToDialog = JSON.stringify({
      message: message,
      title: title
    });
    dialog.messageChild(messageToDialog);
  }
}

function createCustomProperty(propertyName, propertyValue) {
  Word.run((context) => {
    context.document.properties.customProperties.add(propertyName, propertyValue);
    return context.sync().then(() => {
        // console.log(`Custom property '${propertyName}' created with value: ${propertyValue}`);
    });
  }).catch((error) => {
      console.error("Error creating custom property: ", error);
  });
}

async function getCustomProperty(propertyName) {
  return await Word.run(async (context) => {
      const customProperties = context.document.properties.customProperties;
      let customProperty;
      try {
        customProperty = customProperties.getItem(propertyName);
        context.load(customProperty);
        await context.sync();
        return customProperty.value;
      } catch (error) {
        return undefined;
      }
  });
}

async function saveDocumentAsPdfAndSend() {
  try {
    showDialog('Saving', 'Please wait...');
    await Word.run(async (context) => {
      context.document.save();
      await context.sync();        
      const wordBase64 = await saveDocBase64();
      const pdfBase64 = await savePdfBase64(context);
      if (wordBase64 && pdfBase64) {
        await saveToServer(wordBase64, pdfBase64);
        sendMessage('oc-word-saved')
      } else {
        throw new Error(`failed to get document content`);
      }
    });
  } catch (error) {
    showDialog('Error saving document:', error.message);
    console.error("Error saving document:", error);
  }
}

async function savePdfBase64(context) {
  return new Promise((resolve, reject) => {
    Office.context.document.getFileAsync(Office.FileType.Pdf, async (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        try {
          const base64 = await encodeBase64(result.value);
          resolve(base64);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(result.error);
      }
    });
  });
}

async function saveDocBase64() {
  return new Promise((resolve, reject) => {
    Office.context.document.getFileAsync(Office.FileType.Compressed, async (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        try {
          const base64 = await encodeBase64(result.value);
          resolve(base64);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(result.error);
      }
    });
  });
}

async function encodeBase64(file) {
  return new Promise((resolve, reject) => {
    let fileData = '';
    let offset = 0;

    const readNextSlice = () => {
      file.getSliceAsync(offset, (sliceResult) => {
        if (sliceResult.status === Office.AsyncResultStatus.Succeeded) {
          const slice = sliceResult.value;
          fileData += btoa(
            new Uint8Array(slice.data)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          offset += slice.size;
          if (offset < file.size) {
            readNextSlice();
          } else {
            resolve(fileData);
            file.closeAsync();
          }
        } else {
          reject(sliceResult.error);
        }
      });
    };
    readNextSlice();
  });
}

function getCurrentTimestampInMinutes() {
  const currentDate = new Date();
  const timestampInMilliseconds = currentDate.getTime();
  const timestampInMinutes = Math.floor(timestampInMilliseconds / (1000 * 60));  
  return timestampInMinutes;
}

async function saveToServer(wordBase64, pdfBase64) {
  const url = generateUrl('saveData', 
    {
      docId: docId,
      docSetId: docSetId
    });
  const payload = {
      docx: wordBase64,
      pdf: pdfBase64,
      controlNo: getCurrentTimestampInMinutes()
  };

  const response = await fetch(url, {
      method: 'PUT',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      credentials: 'include'
  });
  if (!response.ok) {
    showDialog('Save Failed', response.statusText);
    throw new Error(`Error sending data: ${response.statusText}`);
  } 
  showDialog('Save Successful!', '');
}

async function afterSaved() {
  const url = 'http://localhost:5002/oc/forms/blank-document/messenger.html?action=oc-word-saved&docSetId=' + docSetId;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    credentials: 'include'
  });
  if (!response.ok) {
    showDialog('Alert Failed', '');
    throw new Error(`Error alerting console: ${response.statusText}`);
  } 
  console.log('alert successfull')
}

async function tryCatch(callback) {
  try {
      await callback();
  } catch (error) {
      console.error(error);
  }
}