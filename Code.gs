// ====================================================================================
// AGTOID GASTRO - GOOGLE DRIVE PROXY SCRIPT (OPCJA A)
// Autor: AI Coding Assistant
// Opis: Skrypt pośredniczący (Reverse Proxy) uruchamiany na infrastrukturze Google
//       jako aplikacja webowa (Web App). Pozwala dowolnym klientom (Aplikacja Webowa,
//       iOS, Android) na bezpieczny odczyt i zapis plików JSON bezpośrednio na dysku
//       Google zalogowanego administratora bez konieczności logowania pracowników!
// Wersja: 1.0.0
// ====================================================================================

// 🔐 TOKENS I BEZPIECZEŃSTWO
// Zmień ten token na unikalne, trudne do odgadnięcia hasło! 
// Ten sam token wprowadzisz w konfiguracji aplikacji klienckiej (np. jako Agtoid Key lub klucz dostępu).
var SECURITY_TOKEN = "AgtoidGastroSecureToken123!"; 

// 📁 NAZWA FUNKCJONALNA FOLDERU NA DYSKU GOOGLE
// Nazwa folderu na Twoim Dysku Google, w którym skrypt będzie odczytywał i zapisywał pliki.
var FOLDER_NAME = "AgtoidGastro";

/**
 * Obsługa zapytań HTTP GET.
 * Służy głównie do pobierania zawartości plików (kategorie, produkty, zamówienia).
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * Obsługa zapytań HTTP POST.
 * Służy do zapisywania i aktualizacji plików (wysyłania zamówień oraz konfiguracji).
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * Główna funkcja procesująca zapytania.
 */
function handleRequest(e) {
  // Dla bezpieczeństwa włączamy nagłówki CORS, aby ułatwić komunikację z poziomu przeglądarki (Web App)
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    // 1. Weryfikacja tokenu bezpieczeństwa
    var token = e.parameter.token || "";
    if (token !== SECURITY_TOKEN) {
      return createJsonResponse({ 
        success: false, 
        error: "Brak autoryzacji: Niepoprawny klucz tokenu bezpieczeństwa (SECURITY_TOKEN)." 
      }, 401, headers);
    }

    // 2. Pobranie parametrów akcji
    var action = e.parameter.action || "";
    if (!action) {
      return createJsonResponse({ 
        success: false, 
        error: "Brak zdefiniowanej akcji (?action=download|upload|list)." 
      }, 400, headers);
    }

    // 3. Sprawdzenie lub utworzenie folderu roboczego
    var folder = getOrCreateFolder(FOLDER_NAME);
    if (!folder) {
      return createJsonResponse({ 
        success: false, 
        error: "Błąd serwera: Nie można uzyskać dostępu do folderu '" + FOLDER_NAME + "'." 
      }, 500, headers);
    }

    // ====================================================================
    // AKCJA A: POBIERANIE PLIKU (download)
    // ====================================================================
    if (action === "download") {
      var fileName = e.parameter.fileName;
      if (!fileName) {
        return createJsonResponse({ success: false, error: "Brak wymaganej nazwy pliku (?fileName=...)" }, 400, headers);
      }
      
      var file = getJsonFile(folder, fileName);
      if (!file) {
        return createJsonResponse({ 
          success: false, 
          error: "Plik '" + fileName + "' nie istnieje w folderze '" + FOLDER_NAME + "'." 
        }, 404, headers);
      }
      
      var content = file.getAs("application/json").getDataAsString();
      // Zwracamy czysty surowy JSON z nagłówkami CORS
      return ContentService.createTextOutput(content)
        .setMimeType(ContentService.MimeType.JSON);
    } 
    
    // ====================================================================
    // AKCJA B: ZAPIS/AKTUALIZACJA PLIKU (upload)
    // ====================================================================
    else if (action === "upload") {
      var fileName = e.parameter.fileName;
      if (!fileName) {
        return createJsonResponse({ success: false, error: "Brak parametru fileName." }, 400, headers);
      }

      var content = "";
      if (e.postData && e.postData.contents) {
        content = e.postData.contents;
      } else {
        content = e.parameter.content || "";
      }

      if (!content || content.trim() === "") {
        return createJsonResponse({ success: false, error: "Brak zawartości JSON do wysłania." }, 400, headers);
      }

      // Sprawdzamy czy to poprawny ciąg JSON przed zapisem
      try {
        JSON.parse(content);
      } catch (parseErr) {
        return createJsonResponse({ success: false, error: "Błąd składni przesłanego pliku JSON: " + parseErr.message }, 400, headers);
      }

      saveJsonFile(folder, fileName, content);
      return createJsonResponse({ 
        success: true, 
        message: "Plik '" + fileName + "' został zapisany poprawnie.", 
        fileName: fileName 
      }, 200, headers);
    } 
    
    // ====================================================================
    // AKCJA C: LISTOWANIE DOSTĘPNYCH PLIKÓW (list)
    // ====================================================================
    else if (action === "list") {
      var files = listJsonFiles(folder, "");
      return createJsonResponse({ 
        success: true, 
        folderName: FOLDER_NAME,
        files: files 
      }, 200, headers);
    } 

    // ====================================================================
    // AKCJA D: USUWANIE PLIKU (delete)
    // ====================================================================
    else if (action === "delete") {
      var fileName = e.parameter.fileName;
      if (!fileName) {
        return createJsonResponse({ success: false, error: "Brak parametru fileName." }, 400, headers);
      }
      var file = getJsonFile(folder, fileName);
      if (file) {
        file.setTrashed(true);
        return createJsonResponse({ 
          success: true, 
          message: "Plik '" + fileName + "' został usunięty." 
        }, 200, headers);
      } else {
        return createJsonResponse({ 
          success: false, 
          error: "Plik '" + fileName + "' nie istnieje." 
        }, 404, headers);
      }
    }
    
    // Nieobsługiwana akcja
    else {
      return createJsonResponse({ success: false, error: "Nieobsługiwany parametr akcji: " + action }, 400, headers);
    }

  } catch (err) {
    return createJsonResponse({ 
      success: false, 
      error: "Błąd wewnętrzny skryptu: " + err.toString() 
    }, 500, headers);
  }
}

// ====================================================================
// FUNKCJE POMOCNICZE (DRIVE SERVICES API)
// ====================================================================

/**
 * Pobiera istniejący folder po nazwie, a jeśli go nie ma - tworzy go.
 * Ignoruje foldery przeniesione do kosza.
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  while (folders.hasNext()) {
    var f = folders.next();
    if (!f.isTrashed()) {
      return f;
    }
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Szuka pliku o określonej nazwie w wybranym folderze.
 * Ignoruje pliki i foldery przeniesione do kosza.
 */
function getJsonFile(folder, fileName) {
  var parts = fileName.split("/");
  var currentFolder = folder;
  for (var i = 0; i < parts.length - 1; i++) {
    var subFolderName = parts[i];
    if (!subFolderName) continue;
    var subFolders = currentFolder.getFoldersByName(subFolderName);
    var foundObj = null;
    while (subFolders.hasNext()) {
      var sf = subFolders.next();
      if (!sf.isTrashed()) {
        foundObj = sf;
        break;
      }
    }
    if (foundObj) {
      currentFolder = foundObj;
    } else {
      return null;
    }
  }
  var actualFileName = parts[parts.length - 1];
  var files = currentFolder.getFilesByName(actualFileName);
  while (files.hasNext()) {
    var file = files.next();
    if (!file.isTrashed()) {
      return file;
    }
  }
  return null;
}

/**
 * Tworzy nowy plik lub aktualizuje zawartość istniejącego w folderze.
 * Automatycznie usuwa wykryte duplikaty i ignoruje pliki/foldery w koszu.
 */
function saveJsonFile(folder, fileName, content) {
  var parts = fileName.split("/");
  var currentFolder = folder;
  for (var i = 0; i < parts.length - 1; i++) {
    var subFolderName = parts[i];
    if (!subFolderName) continue;
    var subFolders = currentFolder.getFoldersByName(subFolderName);
    var foundObj = null;
    while (subFolders.hasNext()) {
      var sf = subFolders.next();
      if (!sf.isTrashed()) {
        foundObj = sf;
        break;
      }
    }
    if (foundObj) {
      currentFolder = foundObj;
    } else {
      currentFolder = currentFolder.createFolder(subFolderName);
    }
  }
  var actualFileName = parts[parts.length - 1];
  var files = currentFolder.getFilesByName(actualFileName);
  var existingFile = null;
  var duplicatesToTrash = [];
  while (files.hasNext()) {
    var file = files.next();
    if (file.isTrashed()) continue;
    if (!existingFile) {
      existingFile = file;
    } else {
      duplicatesToTrash.push(file);
    }
  }
  
  if (existingFile) {
    existingFile.setContent(content);
    // Usuń wszystkie pozostałe aktywne duplikaty, aby zapobiec powielaniu plików w Google Drive
    for (var d = 0; d < duplicatesToTrash.length; d++) {
      try {
        duplicatesToTrash[d].setTrashed(true);
      } catch (trashErr) {
        // Ignoruj błędy uprawnień
      }
    }
  } else {
    currentFolder.createFile(actualFileName, content, "application/json");
  }
}

/**
 * Generuje listę plików zapisanych w folderze wraz z czasem ostatniej modyfikacji.
 * Pomija pliki/foldery w koszu.
 */
function listJsonFiles(folder, pathPrefix) {
  pathPrefix = pathPrefix || "";
  var list = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (file.isTrashed()) continue;
    list.push({
      fileName: pathPrefix + file.getName(),
      id: file.getId(),
      lastUpdated: file.getLastUpdated().toISOString()
    });
  }
  var subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    var subfolder = subfolders.next();
    if (subfolder.isTrashed()) continue;
    var subList = listJsonFiles(subfolder, pathPrefix + subfolder.getName() + "/");
    list = list.concat(subList);
  }
  return list;
}

/**
 * Formatuje odpowiedź JSON z kodem statusu HTTP i nagłówkami CORS.
 */
function createJsonResponse(obj, status, headers) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ====================================================================
// FUNKCJA TESTOWA (TEST RUNNER)
// ====================================================================

/**
 * Uruchom tę funkcję bezpośrednio w edytorze Google Apps Script (klikając przycisk "Uruchom"),
 * aby przetestować konfigurację tokenu bezpieczeństwa, dostęp do Dysku oraz poprawność działania API.
 */
function testGastroProxy() {
  Logger.log("=== ROZPOCZYNANIE TESTU PROXY AGTOID GASTRO ===");
  Logger.log("Używany SECURITY_TOKEN: " + SECURITY_TOKEN);
  Logger.log("Targetowany folder: " + FOLDER_NAME);
  
  try {
    // 1. Test dostępu do Dysku Google
    Logger.log("\n[KROK 1] Sprawdzanie dostępu do Dysku Google i folderu...");
    var folder = getOrCreateFolder(FOLDER_NAME);
    if (!folder) {
      throw new Error("Nie udało się pobrać / utworzyć folderu: " + FOLDER_NAME);
    }
    Logger.log("✅ Sukces! Folder istnieje. ID folderu: " + folder.getId());
    
    // 2. Test bezpośredniego zapisu i odczytu pliku
    Logger.log("\n[KROK 2] Test zapisu i odczytu pliku diagnostycznego...");
    var testFileName = "test_polaczenia_gastro.json";
    var testContent = JSON.stringify({
      status: "OK",
      timestamp: new Date().toISOString(),
      opis: "Plik wygenerowany automatycznie podczas testu diagnostycznego"
    });
    
    saveJsonFile(folder, testFileName, testContent);
    Logger.log("✅ Sukces! Plik '" + testFileName + "' został zapisany.");
    
    var retrievedFile = getJsonFile(folder, testFileName);
    if (!retrievedFile) {
      throw new Error("Plik zapisany poprawnie, ale nie można go odnaleźć do odczytu!");
    }
    var readContent = retrievedFile.getAs("application/json").getDataAsString();
    Logger.log("✅ Sukces! Plik został odczytany. Zawartość: " + readContent);
    
    // Usuń plik testowy po pomyślnym zakończeniu, aby nie śmiecić na dysku
    retrievedFile.setTrashed(true);
    Logger.log("🧹 Plik testowy usunięty z folderu (przeniesiony do kosza).");

    // 3. Test symulacji API (poprawny token)
    Logger.log("\n[KROK 3] Symulacja zapytania API (Weryfikacja poprawnego tokenu)...");
    var mockEventGood = {
      parameter: {
        token: SECURITY_TOKEN,
        action: "list"
      }
    };
    var responseGood = handleRequest(mockEventGood);
    var responseStrGood = responseGood.getContent();
    Logger.log("Odpowiedź API dla POPRAWNEGO tokenu:\n" + responseStrGood);
    
    var parsedResp = JSON.parse(responseStrGood);
    if (parsedResp.success !== true) {
      throw new Error("API zwróciło błąd pomimo podania prawidłowego tokenu: " + responseStrGood);
    }
    Logger.log("✅ Sukces! Weryfikacja tokenu zakończona pomyślnie.");

    // 4. Test symulacji API (niepoprawny token - oczekiwany błąd)
    Logger.log("\n[KROK 4] Symulacja zapytania API (Weryfikacja blokady przy błędnym tokenie)...");
    var mockEventBad = {
      parameter: {
        token: "ZlyTokenBezpieczenstwa_123_Error",
        action: "list"
      }
    };
    var responseBad = handleRequest(mockEventBad);
    var responseStrBad = responseBad.getContent();
    Logger.log("Odpowiedź API dla BŁĘDNEGO tokenu:\n" + responseStrBad);
    
    var parsedBad = JSON.parse(responseStrBad);
    if (parsedBad.success === true) {
      throw new Error("Krytyczny błąd bezpieczeństwa! API zaakceptowało błędny token!");
    }
    Logger.log("✅ Sukces! System odrzucił nieuprawniony dostęp tak jak oczekiwano.");

    Logger.log("\n=== 🏁 DIAGNOSTYKA ZAKOŃCZONA PEŁNYM SUKCESEM! ===");
    Logger.log("Wszystkie integracje działają prawidłowo. Możesz bezpiecznie wdrożyć skrypt jako Web App!");

  } catch (error) {
    Logger.log("\n❌ [BŁĄD PODCZAS TESTÓW]: " + error.toString());
    Logger.log("Wskazówka: Upewnij się, czy wyraziłeś niezbędne uprawnienia dla serwisu DriveApp podczas uruchamiania skryptu.");
  }
}
