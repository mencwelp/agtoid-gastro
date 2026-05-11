/* ============================================================
   AGTOID GASTRO — APP.JS (WERSJA PRO)
   Pełny system zamówień gastronomicznych
   ============================================================ */
/* =============================
   GOOGLE DRIVE API CONFIG
   ============================= */

const CLIENT_ID = "1003278496841-72jrdddo4404g8hcd2dsenjqibvir2u1.apps.googleusercontent.com";
const DEVELOPER_KEY = "AIzaSyA3BW59mmS03S60xpoJbeRwH8qZntRBLtQ";
const APP_ID = "1003278496841";
const SCOPES = "https://www.googleapis.com/auth/drive.file";


let driveFolderId = null;

/* =============================
   KONFIGURACJA JĘZYKA
   ============================= */
let LANG = "pt";

const UI = {
  pt: {
    urgente: "URGENTE",
    qtd: "QTD",
  }
};

/* =============================
   FRAMEWORK7 INIT
   ============================= */
const app = new Framework7({
  el: '#app',
  theme: 'auto',
});

let accessToken = null;
let refreshToken = localStorage.getItem("refreshToken");
/*
const googleLoginFirstTime = google.accounts.oauth2.initCodeClient({
  client_id: CLIENT_ID,
  scope: "https://www.googleapis.com/auth/drive.file",
  access_type: "offline",
  prompt: "consent",
  redirect_uri: window.location.origin,
  callback: async (response) => {
    const tokens = await exchangeCodeForTokens(response.code);

    console.log("TOKENS:", tokens);

    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;

    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    initDrive();
  }
});


async function exchangeCodeForTokens(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: window.location.origin
    })
  });

  return await res.json();
}


async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  const data = await res.json();

  if (data.access_token) {
    localStorage.setItem("accessToken", data.access_token);
    return data.access_token;
  }

  return null;
}
async function autoLogin() {
  let token = localStorage.getItem("accessToken");

  if (!token) {
    token = await refreshAccessToken();
  }

  if (token) {
    accessToken = token;
    console.log("Auto-login OK");
    initDrive(); // status ustawi się dopiero po teście
  } else {
    console.log("Brak tokena — użytkownik musi kliknąć logowanie pierwszy raz");
    updateDriveStatus(false);
  }
}
*/
//--------------------------------------------
let pickerToken = null;


// 1. Ładowanie Pickera
function onApiLoad() {
  gapi.load("picker", onPickerApiLoad);
}

window.addEventListener("load", async () => {
  const savedToken = localStorage.getItem("driveAccessToken");
  if (savedToken) {
    pickerToken = savedToken;
    updateDriveStatus(true);
    driveFolderId = await getOrCreateAgtoidFolder();
    await syncFromDrive();
  } else {
    // brak tokena → fallback na ręczne logowanie
    console.warn("Brak zapisanego tokena, wymagane logowanie");
  }
});

async function refreshAccessToken() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response && response.access_token) {
        pickerToken = response.access_token;
        localStorage.setItem("driveAccessToken", pickerToken);
        console.log("Token odświeżony:", pickerToken);
        resolve(pickerToken);
      } else {
        reject("Brak nowego tokena");
      }
    };
    tokenClient.requestAccessToken({ prompt: "" }); // silent refresh
  });
}

setInterval(async () => {
  try {
    await refreshAccessToken();
    updateDriveStatus(true);
  } catch (e) {
    console.warn("Nie udało się odświeżyć tokena:", e);
    updateDriveStatus(false);
  }
}, 50 * 60 * 1000);


function onPickerApiLoad() {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: async (response) => {
      if (response && response.access_token) {
        pickerToken = response.access_token;
		localStorage.setItem("driveAccessToken", pickerToken);
        updateDriveStatus(true);
        driveFolderId = await getOrCreateAgtoidFolder();
        await syncFromDrive();
      }
    }
  });

  // Silent login przy starcie
  tokenClient.requestAccessToken({ prompt: "" });
}

// fallback na kliknięcie
function loginGoogleDrive() {
  tokenClient.requestAccessToken(); // popup, ale tylko po kliknięciu
}



// Funkcja tworząca folder (z poprzednich kroków)
async function getOrCreateAgtoidFolder() {
  let searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name='AgtoidGastro' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    { headers: { Authorization: "Bearer " + pickerToken } }
  );
  let searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  let createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + pickerToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "AgtoidGastro",
      mimeType: "application/vnd.google-apps.folder"
    })
  });

  let createData = await createRes.json();
  return createData.id;
}


async function getOrCreateAgtoidFolder() {
  // 1. Szukamy folderu o nazwie "AgtoidGastro"
  let searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name='AgtoidGastro' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    {
      headers: { Authorization: "Bearer " + pickerToken }
    }
  );
  let searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    // Folder istnieje → zwracamy jego ID
    console.log("Folder AgtoidGastro istnieje:", searchData.files[0].id);
    return searchData.files[0].id;
  }

  // 2. Jeśli folder nie istnieje → tworzymy nowy
  let createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + pickerToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "AgtoidGastro",
      mimeType: "application/vnd.google-apps.folder"
    })
  });

  let createData = await createRes.json();
  console.log("Utworzono folder AgtoidGastro:", createData.id);
  
  return createData.id;
}

function googleLoginFirstTime() {
  // Tutaj możesz wywołać autologin Pickera
  onApiLoad();
  initDrive()

}
function loginGoogleDrive() {
  //googleLoginFirstTime.requestCode();
  onApiLoad();
 initDrive()

}
/*
function loginGoogleDrive() {
  google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      localStorage.setItem("drive_token", accessToken);
      initDrive();
    }
  }).requestAccessToken();
}
*/
function updateDriveStatus(isOnline) {
  const el = document.getElementById("drive-status");
  if (!el) return;

  if (isOnline) {
    el.classList.remove("offline");
    el.classList.add("online");
    el.querySelector(".label").textContent = "Online";
  } else {
    el.classList.remove("online");
    el.classList.add("offline");
    el.querySelector(".label").textContent = "Offline";
  }
}
/*

async function initDrive() {
  const lastLogin = localStorage.getItem("driveConnected");

    if (lastLogin === "true") {
      console.log("Wcześniej połączono z Google – wczytuję dane lokalne i synchronizuję...");
      syncFromDrive();
    }
  
  await new Promise(resolve => gapi.load("client", resolve));

  await gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });

  gapi.client.setToken({ access_token: accessToken });
  console.log("Token ustawiony:", accessToken);

  await ensureDriveFolder();   // 1. folder musi istnieć
  await syncFromDrive();       // 2. pobranie lub inicjalizacja danych
 updateDriveStatus(true);  
  localStorage.setItem("driveConnected", "true");

}

*/
async function initDrive() {
  try {
    await new Promise(resolve => gapi.load("client", resolve));

    await gapi.client.init({
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
    });

    gapi.client.setToken({ access_token: accessToken });

    // TEST TOKENA
    const test = await gapi.client.drive.files.list({
      pageSize: 1
    });

    updateDriveStatus(true); // ← dopiero tutaj

    await ensureDriveFolder();
	driveFolderId = await ensureDriveFolder();
	await syncFromDrive();

  } catch (e) {
    console.error("Drive error:", e);
    updateDriveStatus(false);

    // spróbuj odświeżyć token
    const newToken = await refreshAccessToken();
    if (newToken) {
      accessToken = newToken;
      return initDrive(); // retry
    }
  }
}


async function ensureDriveFolder() {
  console.log("Tworzenie folderu na Drive...");
  /*
  const res = await gapi.client.drive.files.list({
    q: "name='AgtoidGastro' and mimeType='application/vnd.google-apps.folder'",
    fields: "files(id)"
  });

  if (res.result.files.length > 0) {
    driveFolderId = await getOrCreateAgtoidFolder();
    console.log("Folder istnieje:", driveFolderId);
    return;
  }

  const create = await gapi.client.drive.files.create({
    resource: {
      name: "AgtoidGastro",
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id"
  });
*/
  driveFolderId = await getOrCreateAgtoidFolder();
  console.log("Utworzono folder:", driveFolderId);
}

async function saveJsonToDrive(folderId, fileName, jsonData) {
  // 1. Szukamy pliku o podanej nazwie w folderze
  let searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
    {
      headers: { Authorization: "Bearer " + pickerToken }
    }
  );
  let searchData = await searchRes.json();

  // 2. Jeśli plik istnieje → aktualizujemy
  if (searchData.files && searchData.files.length > 0) {
    const fileId = searchData.files[0].id;

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify({})], { type: "application/json" }));
    form.append("file", new Blob([JSON.stringify(jsonData)], { type: "application/json" }));

    let updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + pickerToken },
      body: form
    });

    let updateData = await updateRes.json();
    console.log("Zaktualizowano plik JSON:", updateData);
    return updateData.id;
  }

  // 3. Jeśli plik nie istnieje → tworzymy nowy
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/json"
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(jsonData)], { type: "application/json" }));

  let createRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: "Bearer " + pickerToken },
    body: form
  });

  let createData = await createRes.json();
  console.log("Utworzono nowy plik JSON:", createData);
  return createData.id;
}



async function loadJsonFromDrive(folderId, fileName) {
  // 1. Szukamy pliku o podanej nazwie w folderze
  let searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
    {
      headers: { Authorization: "Bearer " + pickerToken }
    }
  );
  let searchData = await searchRes.json();

  if (!searchData.files || searchData.files.length === 0) {
    console.log("Plik nie znaleziony:", folderId + "" + fileName);
    return null;
  }

  const fileId = searchData.files[0].id;

  // 2. Pobieramy zawartość pliku
  let fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: "Bearer " + pickerToken }
    }
  );

  let jsonData = await fileRes.json();
  console.log("Wczytano plik JSON:", jsonData);
  return jsonData;
}
    

async function findOrCreateFile(filename) {
  const res = await gapi.client.drive.files.list({
    q: `name='${filename}' and '${driveFolderId}' in parents`,
    fields: "files(id)"
  });

  if (res.result.files.length > 0) {
    return res.result.files[0].id;
  }

  const create = await gapi.client.drive.files.create({
    resource: {
      name: filename,
      parents: [driveFolderId],
      mimeType: "application/json"
    },
    fields: "id"
  });

  return create.result.id;
}

async function saveData(scope = "all") {
  try {
    console.log("Start Data save");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));

    if (pickerToken && driveFolderId) {
      console.log("Zapisuję dane na Google Drive...");

      if (scope === "produtos" || scope === "all") {
        await saveJsonToDrive(driveFolderId,"produtos.json", DB.produtos);
      }
      if (scope === "categorias" || scope === "all") {
        await saveJsonToDrive(driveFolderId,"categorias.json", DB.categorias);
      }
      // jeśli chcesz też koszyk:
      if (scope === "pedido") {
        await saveJsonToDrive(driveFolderId,"pedido.json", DB.pedido);
      }

      updateDriveStatus(true);
    } else {
      console.warn("Drive offline, zapis tylko lokalny");
      updateDriveStatus(false);
    }

  } catch (err) {
    console.error("Błąd zapisu danych:", err);
  }
}



async function syncFromDrive() {
  try {
	const produtos = await loadJsonFromDrive(driveFolderId, "produtos.json");
    const categorias = await loadJsonFromDrive(driveFolderId, "categorias.json");

    const emptyProdutos = !Array.isArray(produtos) || produtos.length === 0;
    const emptyCategorias = !Array.isArray(categorias) || categorias.length === 0;

    if (emptyProdutos && emptyCategorias && ( produtos.length === 0 ||categorias.length === 0)) {
      console.log("Inicjalizacja danych domyślnych...");
      initDefaultData();
      console.warn("Start Data save");
      saveData(); // zapis do localStorage + Drive
    } else {
      DB.produtos = Array.isArray(produtos) ? produtos : [];
      DB.categorias = Array.isArray(categorias) ? categorias : [];
    }

    renderPedido();
    renderCatalogo();
    renderCategorias();
	renderFilterCategorias();

  } catch (e) {
			

    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    DB.produtos = local.produtos || [];
    DB.categorias = local.categorias || [];

    renderPedido();
    renderCatalogo();
    renderCategorias();
	renderFilterCategorias();
    
  }
  console.log("Kategorie:", DB.categorias.map(c => c.nome));
  console.log("produtos:", DB.produtos.map(c => c.nome));

}

function initDefaultData() {
  DB.categorias = [
    { id: 1, nome: "Vegetais", cor: "#4ade80", icone: "🥬" },
    { id: 2, nome: "Frutas", cor: "#facc15", icone: "🍊" },
    { id: 3, nome: "Carne", cor: "#ef4444", icone: "🥩" },
    { id: 4, nome: "Peixe", cor: "#3b82f6", icone: "🐟" },
    { id: 5, nome: "Laticínios", cor: "#a855f7", icone: "🥛" },
    { id: 6, nome: "Bebidas", cor: "#0ea5e9", icone: "🥤" },
    { id: 7, nome: "Padaria", cor: "#f97316", icone: "🍞" },
    { id: 8, nome: "Congelados", cor: "#64748b", icone: "❄️" }
  ];

  DB.produtos = [
     { id: 1, nome: "Tomate Chucha", categoria: "Vegetais", unidade: "kg" },
        { id: 2, nome: "Cebola Amarela", categoria: "Vegetais", unidade: "kg" },
        { id: 3, nome: "Batata Nova", categoria: "Vegetais", unidade: "kg" },
        { id: 4, nome: "Alface Iceberg", categoria: "Vegetais", unidade: "unid" },
        { id: 5, nome: "Limões", categoria: "Frutas", unidade: "kg" },
        { id: 6, nome: "Laranjas", categoria: "Frutas", unidade: "kg" },
        { id: 7, nome: "Peito de Frango", categoria: "Carne", unidade: "kg" },
        { id: 8, nome: "Carne Picada", categoria: "Carne", unidade: "kg" },
        { id: 9, nome: "Salmão Fresco", categoria: "Peixe", unidade: "kg" },
        { id: 10, nome: "Bacalhau", categoria: "Peixe", unidade: "kg" },
        { id: 11, nome: "Leite", categoria: "Laticínios", unidade: "litro" },
        { id: 12, nome: "Manteiga", categoria: "Laticínios", unidade: "unid" },
        { id: 13, nome: "Água 1.5L", categoria: "Bebidas", unidade: "unid" },
        { id: 14, nome: "Coca-Cola 1L", categoria: "Bebidas", unidade: "unid" },
        { id: 15, nome: "Pão de Forma", categoria: "Padaria", unidade: "unid" },
        { id: 16, nome: "Croissant", categoria: "Padaria", unidade: "unid" },
        { id: 17, nome: "Ervilhas Congeladas", categoria: "Congelados", unidade: "pacote" },
        { id: 18, nome: "Batatas Fritas Congeladas", categoria: "Congelados", unidade: "pacote" }
  ];
  console.log("Kategorie:", DB.categorias.map(c => c.nome));
    console.log("produtos:", DB.produtos.map(c => c.nome));
}


document.getElementById("btnDrive").addEventListener("click", loginGoogleDrive);
document.getElementById("drive-status").addEventListener("click", loginGoogleDrive);




/* =============================
   LOCAL STORAGE
   ============================= */
const STORAGE_KEY = "agtoid_data";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = {
      categorias: [
        { id: 1, nome: "Vegetais", cor: "#4ade80", icone: "🥬" },
        { id: 2, nome: "Frutas", cor: "#fbbf24", icone: "🍊" },
        { id: 3, nome: "Carne", cor: "#ef4444", icone: "🥩" },
        { id: 4, nome: "Peixe", cor: "#3b82f6", icone: "🐟" },
        { id: 5, nome: "Laticínios", cor: "#a78bfa", icone: "🥛" },
        { id: 6, nome: "Bebidas", cor: "#0ea5e9", icone: "🥤" },
        { id: 7, nome: "Padaria", cor: "#f97316", icone: "🍞" },
        { id: 8, nome: "Congelados", cor: "#64748b", icone: "❄️" }
      ],

      produtos: [
        { id: 1, nome: "Tomate Chucha", categoria: "Vegetais", unidade: "kg" },
        { id: 2, nome: "Cebola Amarela", categoria: "Vegetais", unidade: "kg" },
        { id: 3, nome: "Batata Nova", categoria: "Vegetais", unidade: "kg" },
        { id: 4, nome: "Alface Iceberg", categoria: "Vegetais", unidade: "unid" },
        { id: 5, nome: "Limões", categoria: "Frutas", unidade: "kg" },
        { id: 6, nome: "Laranjas", categoria: "Frutas", unidade: "kg" },
        { id: 7, nome: "Peito de Frango", categoria: "Carne", unidade: "kg" },
        { id: 8, nome: "Carne Picada", categoria: "Carne", unidade: "kg" },
        { id: 9, nome: "Salmão Fresco", categoria: "Peixe", unidade: "kg" },
        { id: 10, nome: "Bacalhau", categoria: "Peixe", unidade: "kg" },
        { id: 11, nome: "Leite", categoria: "Laticínios", unidade: "litro" },
        { id: 12, nome: "Manteiga", categoria: "Laticínios", unidade: "unid" },
        { id: 13, nome: "Água 1.5L", categoria: "Bebidas", unidade: "unid" },
        { id: 14, nome: "Coca-Cola 1L", categoria: "Bebidas", unidade: "unid" },
        { id: 15, nome: "Pão de Forma", categoria: "Padaria", unidade: "unid" },
        { id: 16, nome: "Croissant", categoria: "Padaria", unidade: "unid" },
        { id: 17, nome: "Ervilhas Congeladas", categoria: "Congelados", unidade: "pacote" },
        { id: 18, nome: "Batatas Fritas Congeladas", categoria: "Congelados", unidade: "pacote" }
      ],

      pedido: []
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(raw);
}



let DB = loadData();

/* =============================
   GLOBALNE FILTRY
   ============================= */
let currentFiltro = "all";
let currentSearch = "";

/* =============================
   RENDER — ENCOMENDA
   ============================= */
function renderPedido() {
  const lista = document.getElementById("listaPedido");
  lista.innerHTML = "";

  const grupos = {};
  DB.produtos.forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  });

  Object.keys(grupos).forEach(cat => {
    if (currentFiltro !== "all" && currentFiltro !== cat && currentFiltro !== "urgente") return;

    const catInfo = DB.categorias.find(c => c.nome === cat);
    const header = document.createElement("div");
    header.className = "categoria-header";

    if (catInfo) {
      header.style.background = catInfo.cor;
      header.innerHTML = `
        <span class="categoria-icone">${catInfo.icone}</span>
        <span class="categoria-label">${cat}</span>
      `;
    } else {
      // fallback – jeśli kategoria nie istnieje w DB.categorias
      header.style.background = "#999";
      header.innerHTML = `
        <span class="categoria-icone">❓</span>
        <span class="categoria-label">${cat}</span>
      `;
    }

    lista.appendChild(header);


    grupos[cat].forEach(prod => {
      const item = DB.pedido.find(p => p.id === prod.id) || {
        id: prod.id,
        nome: prod.nome,
        categoria: prod.categoria,
        unidade: prod.unidade,
        quantidade: 0,
        prioridade: "Normal"
      };

      if (currentFiltro === "urgente" && item.prioridade !== "Urgente") return;
      if (currentSearch && !item.nome.toLowerCase().includes(currentSearch.toLowerCase())) return;

      const card = document.createElement("div");
      card.className = "produto-card";
      if (item.prioridade === "Urgente") card.classList.add("urgente");

      card.innerHTML = `
        <div class="produto-top">
          <div class="produto-nome">${item.nome}</div>
          <label class="produto-urgente">
            <input type="checkbox" data-id="${item.id}" ${item.prioridade === "Urgente" ? "checked" : ""}>
            <span>${UI[LANG].urgente}</span>
          </label>
        </div>

        <div class="produto-controles">
          <button class="btn-qty" data-id="${item.id}" data-op="-">-</button>

          <div class="produto-qtd-box">
            <span class="qtd-label">${UI[LANG].qtd}</span>
            <input class="quantidade-input" type="number" value="${item.quantidade}" data-id="${item.id}">
            <span class="produto-unidade-box">${(item.unidade || "").toUpperCase()}</span>
          </div>

          <button class="btn-qty" data-id="${item.id}" data-op="+">+</button>
        </div>

        <div class="produto-controles">
          <button class="btn-quick" data-id="${item.id}" data-add="0.5">+0.5</button>
          <button class="btn-quick" data-id="${item.id}" data-add="5">+5</button>
          <button class="btn-quick" data-id="${item.id}" data-add="10">+10</button>
        </div>
      `;

      lista.appendChild(card);
    });
  });

  updateStatusBar();
}

/* =============================
   STATUS BAR
   ============================= */
function updateStatusBar() {
  const total = DB.pedido.filter(p => p.quantidade > 0).length;
  const urg = DB.pedido.filter(p => p.prioridade === "Urgente").length;

  document.getElementById("statusTotal").innerText = `Total: ${total} itens`;
  document.getElementById("statusUrgente").innerText = `Urgente: ${urg}`;
}

/* =============================
   RENDER — CATÁLOGO
   ============================= */
function renderCatalogo() {
  const lista = document.getElementById("listaProdutos");
  lista.innerHTML = "";

  DB.produtos.forEach(prod => {
    const div = document.createElement("div");
    div.className = "catalogo-item";
     if (currentSearch && !prod.nome.toLowerCase().includes(currentSearch.toLowerCase())) return;
	  if (currentFiltro !== "all" && currentFiltro !== prod.categoria) return;
    div.innerHTML = `
      <div class="catalogo-info">
        <div class="catalogo-nome">${prod.nome}</div>
        <div class="catalogo-meta">${prod.categoria} • ${prod.unidade}</div>
      </div>

      <div class="catalogo-actions">
        <button data-edit="${prod.id}">✏️</button>
      </div>
    `;

    lista.appendChild(div);
  });
}

/* =============================
   RENDER — CATEGORIAS
   ============================= */
function renderCategorias() {
  const lista = document.getElementById("listaCategorias");
  lista.innerHTML = "";

  DB.categorias.forEach(cat => {
    const div = document.createElement("div");
    div.className = "categoria-card";

    div.innerHTML = `
      <div class="categoria-main">
        <span class="categoria-icone">${cat.icone}</span>
        <span class="categoria-nome">${cat.nome}</span>
      </div>

      <div class="categoria-actions">
        <button data-edit-cat="${cat.id}">✏️</button>
      </div>
    `;

    lista.appendChild(div);
  });
}

function renderFilterCategorias() {
  const filter = document.getElementById("filterCategorias");
  filter.innerHTML = "";

  // opcja "Todas as categorias"
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Todas as categorias";
  filter.appendChild(optAll);

  // iteracja po kategoriach z DB   
  DB.categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.nome;
    opt.textContent = cat.nome;
    filter.appendChild(opt);
  });
}

/* =============================
   CRUD — PRODUKT
   ============================= */
let editProdutoId = null;

document.getElementById("btnAddProduto").addEventListener("click", () => {
  editProdutoId = null;
  document.getElementById("produtoTitulo").innerText = "Adicionar Produto";
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoUnidade").value = "kg";

  const sel = document.getElementById("produtoCategoria");
  sel.innerHTML = "";
  DB.categorias.forEach(c => {
    sel.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
  });

  app.popup.open("#popupProduto");
});

document.getElementById("btnSalvarProduto").addEventListener("click", () => {
  const nome = document.getElementById("produtoNome").value.trim();
  const categoria = document.getElementById("produtoCategoria").value;
  const unidade = document.getElementById("produtoUnidade").value;

  if (!nome) return;

  if (editProdutoId) {
    const p = DB.produtos.find(x => x.id === editProdutoId);
    p.nome = nome;
    p.categoria = categoria;
    p.unidade = unidade;
  } else {
    DB.produtos.push({
      id: Date.now(),
      nome,
      categoria,
      unidade
    });
  }

  saveData("produtos");
  renderCatalogo();
  renderPedido();
  app.popup.close("#popupProduto");
});

/* =============================
   CRUD — KATEGORIA
   ============================= */
let editCategoriaId = null;

document.getElementById("btnAddCategoria").addEventListener("click", () => {
  editCategoriaId = null;
  document.getElementById("categoriaTitulo").innerText = "Adicionar Categoria";
  document.getElementById("categoriaNome").value = "";
  document.getElementById("categoriaIcone").value = "";
  document.getElementById("categoriaCor").value = "#4ade80";

  app.popup.open("#popupCategoria");
});

document.getElementById("btnSalvarCategoria").addEventListener("click", () => {
  const nome = document.getElementById("categoriaNome").value.trim();
  const icone = document.getElementById("categoriaIcone").value.trim();
  const cor = document.getElementById("categoriaCor").value;

  if (!nome) return;

  if (editCategoriaId) {
    const c = DB.categorias.find(x => x.id === editCategoriaId);
    c.nome = nome;
    c.icone = icone;
    c.cor = cor;
  } else {
    DB.categorias.push({
      id: Date.now(),
      nome,
      icone,
      cor
    });
  }

  saveData("categorias");
  renderCategorias();
  renderCatalogo();
  renderPedido();
  renderFilterCategorias();
  app.popup.close("#popupCategoria");
});

/* =============================
   FILTRY
   ============================= */
document.getElementById("filterCategorias").addEventListener("change", e => {
  currentFiltro = e.target.value;
  renderPedido();
   renderCatalogo();

});

document.getElementById("filterUrgente").addEventListener("click", () => {
  currentFiltro = currentFiltro === "urgente" ? "all" : "urgente";
  renderPedido();
 renderCatalogo();

});

document.getElementById("searchInput").addEventListener("input", e => {
  currentSearch = e.target.value;
  renderPedido();
 renderCatalogo();
    
});

/* =============================
   ZMIANA ILOŚCI
   ============================= */
document.addEventListener("click", e => {
  if (e.target.dataset.op) {
    const id = Number(e.target.dataset.id);
    const op = e.target.dataset.op;

    let item = DB.pedido.find(p => p.id === id);
    if (!item) {
      const prod = DB.produtos.find(p => p.id === id);
      item = { ...prod, quantidade: 0, prioridade: "Normal" };
      DB.pedido.push(item);
    }

    item.quantidade = Math.max(0, item.quantidade + (op === "+" ? 1 : -1));
    saveData("pedido");
    renderPedido();
  }

  if (e.target.dataset.add) {
    const id = Number(e.target.dataset.id);
    const add = Number(e.target.dataset.add);

    let item = DB.pedido.find(p => p.id === id);
    if (!item) {
      const prod = DB.produtos.find(p => p.id === id);
      item = { ...prod, quantidade: 0, prioridade: "Normal" };
      DB.pedido.push(item);
    }

    item.quantidade += add;
    saveData("pedido");
    renderPedido();
  }
});

/* =============================
   URGENTE CHECKBOX
   ============================= */
document.addEventListener("change", e => {
  if (e.target.type === "checkbox" && e.target.dataset.id) {
    const id = Number(e.target.dataset.id);
    let item = DB.pedido.find(p => p.id === id);

    if (!item) {
      const prod = DB.produtos.find(p => p.id === id);
      item = { ...prod, quantidade: 0, prioridade: "Normal" };
      DB.pedido.push(item);
    }

    item.prioridade = e.target.checked ? "Urgente" : "Normal";
    saveData("pedido");
    renderPedido();
  }
});

/* =============================
   GENEROWANIE RAPORTU
   ============================= */
document.getElementById("btnGeneruj").addEventListener("click", () => {
  gerarRelatorio();
  app.tab.show("#tab-relatorio");
});

function gerarRelatorio() {
  const tabela = document.getElementById("tabelaRelatorio");
  tabela.innerHTML = "";
    const agora = new Date();
    const dataFormatada = agora.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  let texto = "📋 RELATÓRIO DE ENCOMENDA\n${dataFormatada}\n================\n\n";

  const grupos = {};

  DB.pedido.forEach(p => {
    if (p.quantidade > 0) {
      if (!grupos[p.categoria]) grupos[p.categoria] = [];
      grupos[p.categoria].push(p);
    }
  });

  Object.keys(grupos).forEach(cat => {
    tabela.innerHTML += `
      <tr><th colspan="4">${cat}</th></tr>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Unidade</th>
        <th>Status</th>
      </tr>
    `;

    texto += `📁 CATEGORIA: ${cat}\n------------------------------------\n`;

    grupos[cat].forEach(p => {
      tabela.innerHTML += `
        <tr>
          <td>${p.nome}</td>
          <td>${p.quantidade}</td>
          <td>${p.unidade}</td>
          <td>${p.prioridade}</td>
        </tr>
      `;

      texto += `* ${p.nome}: ${p.quantidade} ${p.unidade}`;
      if (p.prioridade === "Urgente") texto += " 🚨 URGENTE";
      texto += "\n";
    });

    texto += "\n";
  });

  document.getElementById("relatorioTexto").value = texto;
}

/* =============================
   EKSPORTY
   ============================= */
document.getElementById("btnCopiarRelatorio").addEventListener("click", () => {
  const ta = document.getElementById("relatorioTexto");
  ta.select();
  document.execCommand("copy");
});

document.getElementById("btnExportWhatsApp").addEventListener("click", () => {
  const txt = encodeURIComponent(document.getElementById("relatorioTexto").value);
  window.open(`https://wa.me/?text=${txt}`, "_blank");
});

document.getElementById("btnExportEmail").addEventListener("click", () => {
  const txt = encodeURIComponent(document.getElementById("relatorioTexto").value);
  window.location.href = `mailto:?subject=Encomenda&body=${txt}`;
});

document.getElementById("btnPrint").addEventListener("click", () => {
  window.print();
});

/* =============================
   RESET CATÁLOGO
   ============================= */
document.getElementById("btnClear").addEventListener("click", () => {
  DB.pedido = [];
  saveData();
  renderPedido();
});

/* =============================
   START
   ============================= */

// pierwsze renderowanie
renderPedido();
renderCatalogo();
renderCategorias();

/* =============================
   EDYCJA PRODUKTU Z LISTY CATÁLOGO
   ============================= */
document.getElementById("listaProdutos").addEventListener("click", e => {
  const id = e.target.dataset.edit;
  if (!id) return;

  const prod = DB.produtos.find(p => p.id === Number(id));
  if (!prod) return;

  editProdutoId = prod.id;
  document.getElementById("produtoTitulo").innerText = "Editar Produto";
  document.getElementById("produtoNome").value = prod.nome;
  document.getElementById("produtoUnidade").value = prod.unidade;

  const sel = document.getElementById("produtoCategoria");
  sel.innerHTML = "";
  DB.categorias.forEach(c => {
    sel.innerHTML += `<option value="${c.nome}" ${c.nome === prod.categoria ? "selected" : ""}>${c.nome}</option>`;
  });

  app.popup.open("#popupProduto");
});

/* =============================
   USUWANIE PRODUKTU
   ============================= */
document.getElementById("btnExcluirProduto").addEventListener("click", () => {
  if (!editProdutoId) {
    app.popup.close("#popupProduto");
    return;
  }

  DB.produtos = DB.produtos.filter(p => p.id !== editProdutoId);
  DB.pedido = DB.pedido.filter(p => p.id !== editProdutoId);

  saveData();
  renderCatalogo();
  renderPedido();
  app.popup.close("#popupProduto");
});

/* =============================
   EDYCJA KATEGORII Z LISTY
   ============================= */
document.getElementById("listaCategorias").addEventListener("click", e => {
  const id = e.target.dataset.editCat;
  if (!id) return;

  const cat = DB.categorias.find(c => c.id === Number(id));
  if (!cat) return;

  editCategoriaId = cat.id;
  document.getElementById("categoriaTitulo").innerText = "Editar Categoria";
  document.getElementById("categoriaNome").value = cat.nome;
  document.getElementById("categoriaIcone").value = cat.icone;
  document.getElementById("categoriaCor").value = cat.cor;

  app.popup.open("#popupCategoria");
});

/* =============================
   USUWANIE KATEGORII
   ============================= */
document.getElementById("btnExcluirCategoria").addEventListener("click", () => {
  if (!editCategoriaId) {
    app.popup.close("#popupCategoria");
    return;
  }

  const cat = DB.categorias.find(c => c.id === editCategoriaId);
  if (!cat) {
    app.popup.close("#popupCategoria");
    return;
  }

  // usuwamy kategorię
  DB.categorias = DB.categorias.filter(c => c.id !== editCategoriaId);

  // produkty z tej kategorii też usuwamy (prosto, bez mapowania)
  DB.produtos = DB.produtos.filter(p => p.categoria !== cat.nome);
  DB.pedido = DB.pedido.filter(p => p.categoria !== cat.nome);

  saveData();
  renderCategorias();
  renderCatalogo();
  renderPedido();
  app.popup.close("#popupCategoria");
});

/* =============================
   RESET CATÁLOGO + CATEGORIAS
   ============================= */
document.getElementById("btnResetCatalogo").addEventListener("click", () => {
  if (!confirm("Repor catálogo e categorias para o estado inicial?")) return;

  localStorage.removeItem(STORAGE_KEY);
  DB = loadData();

  currentFiltro = "all";
  currentSearch = "";

  renderPedido();
  renderCatalogo();
  renderCategorias();
});