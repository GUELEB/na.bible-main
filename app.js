document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const bookSelect = document.getElementById('book-select');
    const chapterSelect = document.getElementById('chapter-select');
    const verseSelect = document.getElementById('verse-select');
    const goToReferenceBtn = document.getElementById('go-to-reference-btn');
    const themeToggle = document.getElementById('theme-toggle');

    // Vistas de contenido.
    const contentArea = document.getElementById('content-area');
    const homeView = document.getElementById('home-view');
    const resultListView = document.getElementById('result-list-view');
    const readView = document.getElementById('read-view');
    const singleResultView = document.getElementById('single-result-view');
    
    // Contenedores de contenido
    const resultListContent = document.getElementById('result-list-content');
    const chapterContent = document.getElementById('chapter-content');
    const singleResultContent = document.getElementById('single-result-content');
    const votdContent = document.getElementById('votd-content');
    const votdReference = document.getElementById('votd-reference');

    // Títulos de las vistas
    const readViewTitle = document.getElementById('read-view-title');
    const singleViewTitle = document.getElementById('single-view-title');
    
    // Botones de navegación y acción
    const prevChapterBtn = document.getElementById('prev-chapter-btn');
    const nextChapterBtn = document.getElementById('next-chapter-btn');
    const prevVerseBtn = document.getElementById('prev-verse-btn');
    const nextVerseBtn = document.getElementById('next-verse-btn');
    const prevSearchResultBtn = document.getElementById('prev-search-result-btn');
    const nextSearchResultBtn = document.getElementById('next-search-result-btn');
    
    const backToHomeBtnList = document.getElementById('back-to-home-btn-list');
    const backToHomeBtnRead = document.getElementById('back-to-home-btn-read');
    const backToResultsBtn = document.getElementById('back-to-results-btn');

    const copyChapterBtn = document.getElementById('copy-chapter-btn');
    const shareChapterBtn = document.getElementById('share-chapter-btn');
    const copySingleBtn = document.getElementById('copy-single-btn');
    const shareSingleBtn = document.getElementById('share-single-btn');


    // --- ESTADO DE LA APLICACIÓN ---
    let bibleIndex = [];
    let hymnsIndex = [];
    let bibleBooksData = {}; // Caché para datos de libros
    
    let currentState = {
        bookKey: null,
        chapter: null,
        verse: null, // Si es un solo versículo
        verseCount: 0,
        searchResults: [],
        searchResultIndex: -1,
        lastQuery: '',
        view: 'home' // Vistas: 'home', 'results', 'read', 'single'
    };


    // --- INICIALIZACIÓN ---
    const initializeApp = async () => {
        setupEventListeners();
        setupTheme();
        await loadBibleIndex();
        await loadHymnsIndex();
        parseHymnsData(); // <<--- NUEVA FUNCIÓN PARA PROCESAR HIMNOS
        await setupReferenceNavigation();
        displayVerseOfTheDay();

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Ruta relativa para el service worker
                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => console.log('Service Worker registrado:', reg.scope))
                    .catch(err => console.error('Error al registrar Service Worker:', err));
            });
        }
    };

    // --- MANEJO DE EVENTOS ---
    function setupEventListeners() {
        searchButton.addEventListener('click', doSearch);
        searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
        goToReferenceBtn.addEventListener('click', goToReference);

        // Navegación de lectura
        prevChapterBtn.addEventListener('click', () => navigateChapter(-1));
        nextChapterBtn.addEventListener('click', () => navigateChapter(1));
        prevVerseBtn.addEventListener('click', () => navigateVerse(-1));
        nextVerseBtn.addEventListener('click', () => navigateVerse(1));

        // Navegación de resultados de búsqueda
        prevSearchResultBtn.addEventListener('click', () => navigateSearchResult(-1));
        nextSearchResultBtn.addEventListener('click', () => navigateSearchResult(1));
        
        // Botones "Atrás"
        backToHomeBtnList.addEventListener('click', showHomeView);
        backToHomeBtnRead.addEventListener('click', showHomeView);
        backToResultsBtn.addEventListener('click', showResultListView);

        // Copiar y Compartir
        copyChapterBtn.addEventListener('click', copyReadViewContent);
        shareChapterBtn.addEventListener('click', shareReadViewContent);
        copySingleBtn.addEventListener('click', copySingleViewContent);
        shareSingleBtn.addEventListener('click', shareSingleViewContent);
    }
    

    // --- GESTIÓN DE LA INTERFAZ (UI) ---
    function updateView(view) {
        currentState.view = view;
        [homeView, resultListView, readView, singleResultView].forEach(v => v.classList.add('hidden'));

        switch (view) {
            case 'home':
                homeView.classList.remove('hidden');
                break;
            case 'results':
                resultListView.classList.remove('hidden');
                break;
            case 'read':
                readView.classList.remove('hidden');
                break;
            case 'single':
                singleResultView.classList.remove('hidden');
                break;
        }
        contentArea.scrollTop = 0; // Scroll al inicio al cambiar de vista
    }

    function showHomeView() {
        searchInput.value = '';
        currentState.lastQuery = '';
        updateView('home');
    }

    function showResultListView() {
        updateView('results');
    }

    // --- CARGA Y PROCESAMIENTO DE DATOS ---
    async function loadBibleIndex() {
        try {
            // Ruta relativa
            const response = await fetch('data/biblia/_index.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            bibleIndex = await response.json();
            bibleIndex.forEach((book, index) => book.id = index + 1);
            console.log('📖 Índice de la Biblia cargado.');
        } catch (err) {
            console.error('Error al cargar el índice de la Biblia:', err);
            searchInput.placeholder = "Error al cargar datos de la Biblia.";
            searchInput.disabled = true;
        }
    }

    async function loadHymnsIndex() {
        try {
            // Ruta relativa
            const response = await fetch('data/himnario/index.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            hymnsIndex = await response.json();
            console.log('🎶 Índice de himnos cargado.');
        } catch (err) {
            console.error('Error al cargar los himnos:', err);
        }
    }

    // ¡NUEVA FUNCIÓN! Procesa el texto de los himnos para separar título, estrofas y coro
    function parseHymnsData() {
        if (!hymnsIndex || hymnsIndex.length === 0) return;

        const CORO_MARKER = '@CORO';
        hymnsIndex = hymnsIndex.map(hymn => {
            const fullText = hymn.title || ''; // Usar 'title' como el texto completo
            const parts = fullText.split(/\n\s*\*{3}\s*\n/); // Separar por ***

            const newHymn = {
                number: hymn.number,
                book: hymn.book,
                title: '',
                chorus: null,
                stanzas: [],
                startsWithChorus: false,
                tags: hymn.tags // Conservar las etiquetas si existen
            };

            // La primera parte contiene el título del himno
            const titleBlock = parts.shift().trim();
            const titleLines = titleBlock.split('\n');
            newHymn.title = titleLines[0].replace(/^\d+\s*/, '').trim();

            // Procesar el resto de las partes como estrofas o coro
            for (const part of parts) {
                let currentPart = part.trim();
                if (currentPart.startsWith(CORO_MARKER)) {
                    // Es un coro
                    newHymn.chorus = currentPart.replace(CORO_MARKER, '').trim();
                    if (newHymn.stanzas.length === 0) {
                        newHymn.startsWithChorus = true;
                    }
                } else if (currentPart) {
                    // Es una estrofa
                    newHymn.stanzas.push(currentPart);
                }
            }
            
            // Si después de procesar, no hay estrofas pero sí hay líneas de título, usarlas como estrofas
            if (newHymn.stanzas.length === 0 && titleLines.length > 1) {
                 newHymn.stanzas = titleLines.slice(1).map(line => line.trim()).filter(line => line);
            }

            return newHymn;
        });
        console.log('🎶 Índice de himnos procesado y estructurado.');
    }

    async function loadBibleBookData(bookKey) {
        if (bibleBooksData[bookKey]) return bibleBooksData[bookKey];
        try {
            // Ruta relativa
            const response = await fetch(`data/biblia/${bookKey}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            bibleBooksData[bookKey] = data;
            return data;
        } catch (error) {
            console.error(`Error al cargar el libro ${bookKey}:`, error);
            return null;
        }
    }
    
    // --- LÓGICA DE BÚSQUEDA ---
    function normalizeText(text) {
        if (typeof text !== 'string') return '';
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    async function doSearch() {
        const query = searchInput.value.trim();
        if (query === '') return;

        currentState.lastQuery = query;
        resultListContent.innerHTML = '<p>Buscando...</p>';
        updateView('results');

        const bibleReference = parseBibleReference(query);
        if (bibleReference) {
            await displayBibleReference(bibleReference);
        } else {
            const bibleResults = await searchVerses(query);
            const hymnResults = searchHymns(query);
            currentState.searchResults = [...bibleResults, ...hymnResults];
            
            currentState.searchResults.sort((a, b) => {
                if (a.type === 'bible' && b.type === 'hymn') return -1;
                if (a.type === 'hymn' && b.type === 'bible') return 1;
                if (a.type === 'bible') {
                    return a.bookId - b.bookId || a.chapter - b.chapter || a.verse - b.verse;
                }
                if (a.type === 'hymn') return a.number - b.number;
                return 0;
            });
            
            displaySearchResultsList();
        }
    }

    function parseBibleReference(query) {
        const regex = /^((\d\s*)?[a-zA-Záéíóúüñ\s]+)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:-?(\d+))?)?$/i;
        const match = query.match(regex);
    
        if (!match) return null;
    
        const bookNameInput = match[1].trim();
        const chapterNum = parseInt(match[3], 10);
        const startVerse = match[4] ? parseInt(match[4], 10) : null;
        const endVerse = match[5] ? parseInt(match[5], 10) : (startVerse ? startVerse : null);
    
        const normalizedBookName = normalizeText(bookNameInput);
    
        const foundBook = bibleIndex.find(book =>
            normalizeText(book.title) === normalizedBookName ||
            (book.shortTitle && normalizeText(book.shortTitle) === normalizedBookName) ||
            (book.abbr && normalizeText(book.abbr) === normalizedBookName) ||
            (book.aliases && Array.isArray(book.aliases) && book.aliases.map(normalizeText).includes(normalizedBookName))
        );

        if (foundBook) {
            return { bookKey: foundBook.key, chapter: chapterNum, startVerse, endVerse };
        }
    
        // Alias manual para 'Cantar de los Cantares'
        if (normalizedBookName === "cantares" || normalizedBookName === "cantar") {
            const cantarBook = bibleIndex.find(b => b.key === 'cantares');
            if (cantarBook) return { bookKey: cantarBook.key, chapter: chapterNum, startVerse, endVerse };
        }

        return null;
    }
    
    async function searchVerses(query) {
        const normalizedQuery = normalizeText(query);
        const results = [];
        let searchTerms;
        let isExactPhrase = false;
    
        if (query.startsWith('"') && query.endsWith('"')) {
            isExactPhrase = true;
            searchTerms = [normalizeText(query.substring(1, query.length - 1))];
        } else {
            searchTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);
        }
    
        if (searchTerms.length === 0) return results;
    
        for (const bookInfo of bibleIndex) {
            const bookData = await loadBibleBookData(bookInfo.key);
            if (bookData) {
                bookData.forEach((chapterVerses, chapterIndex) => {
                    chapterVerses.forEach((verseText, verseIndex) => {
                        const normalizedVerseText = normalizeText(verseText);
                        let match = isExactPhrase
                            ? normalizedVerseText.includes(searchTerms[0])
                            : searchTerms.every(term => normalizedVerseText.includes(term));
                        
                        if (match) {
                            results.push({
                                type: 'bible',
                                bookId: bookInfo.id,
                                bookTitle: bookInfo.title,
                                bookKey: bookInfo.key,
                                chapter: chapterIndex + 1,
                                verse: verseIndex + 1,
                                text: verseText
                            });
                        }
                    });
                });
            }
        }
        return results;
    }

    function searchHymns(query) {
        const normalizedQuery = normalizeText(query);
        const results = [];
        let searchTerms;
        let isExactPhrase = false;
    
        if (query.startsWith('"') && query.endsWith('"')) {
            isExactPhrase = true;
            searchTerms = [normalizeText(query.substring(1, query.length - 1))];
        } else {
            searchTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);
        }
    
        if (searchTerms.length === 0) return results;
    
        hymnsIndex.forEach(hymn => {
            const hymnContent = [
                hymn.title,
                ...(hymn.stanzas || []),
                hymn.chorus || ''
            ].map(normalizeText).join(' ');

            let matchFound = isExactPhrase
                ? hymnContent.includes(searchTerms[0])
                : searchTerms.every(term => hymnContent.includes(term));
    
            if (matchFound) {
                results.push({ type: 'hymn', ...hymn });
            }
        });
        return results;
    }

    // --- FUNCIONES DE VISUALIZACIÓN ---
    
    async function displayVerseOfTheDay() {
        if (bibleIndex.length === 0) return;
        try {
            const randomBook = bibleIndex[Math.floor(Math.random() * bibleIndex.length)];
            const bookData = await loadBibleBookData(randomBook.key);
            if (!bookData) return;
            const randomChapterIndex = Math.floor(Math.random() * bookData.length);
            const randomVerseIndex = Math.floor(Math.random() * bookData[randomChapterIndex].length);
            
            const verseText = bookData[randomChapterIndex][randomVerseIndex];
            const referenceText = `${randomBook.title} ${randomChapterIndex + 1}:${randomVerseIndex + 1}`;
            
            votdContent.textContent = verseText;
            votdReference.textContent = referenceText;
        } catch (error) {
            votdContent.textContent = 'No se pudo cargar el versículo del día.';
            console.error('Error en VOTD:', error);
        }
    }

    async function displayBibleReference(ref) {
        if (!ref.startVerse) {
            await displayBibleChapter(ref.bookKey, ref.chapter);
        } else {
            await displayBibleVerses(ref.bookKey, ref.chapter, ref.startVerse, ref.endVerse);
        }
    }

    function displaySearchResultsList() {
        let html = '';
        if (currentState.searchResults.length === 0) {
            html = `<p>No se encontraron resultados para "${currentState.lastQuery}".</p>`;
        } else {
             document.getElementById('result-list-title').textContent = `Resultados para "${currentState.lastQuery}"`;
            currentState.searchResults.forEach((result, index) => {
                if (result.type === 'bible') {
                    const highlightedText = highlightText(result.text, currentState.lastQuery);
                    html += `
                        <div class="result-item verse-result" data-result-index="${index}">
                            <p><strong>${result.bookTitle} ${result.chapter}:${result.verse}</strong>: ${highlightedText}</p>
                        </div>`;
                } else if (result.type === 'hymn') {
                    const highlightedTitle = highlightText(result.title, currentState.lastQuery);
                    html += `
                        <div class="result-item hymn-result" data-result-index="${index}">
                            <h4>Himno ${result.number} - ${highlightedTitle}</h4>
                            <p><em>(${result.book})</em></p>
                        </div>`;
                }
            });
        }
        resultListContent.innerHTML = html;
        
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', e => {
                const index = parseInt(e.currentTarget.dataset.resultIndex, 10);
                displaySingleSearchResult(index);
            });
        });
        updateView('results');
    }

    function displaySingleSearchResult(index) {
        if (index < 0 || index >= currentState.searchResults.length) return;

        currentState.searchResultIndex = index;
        const result = currentState.searchResults[index];
        let html = '';

        if (result.type === 'bible') {
            singleViewTitle.textContent = `${result.bookTitle} ${result.chapter}:${result.verse}`;
            html = `<p>${highlightText(result.text, currentState.lastQuery)}</p>`;
        } else if (result.type === 'hymn') {
            singleViewTitle.textContent = `Himno ${result.number}: ${result.title}`;
            let content = '';
            if (result.startsWithChorus && result.chorus) {
                content += `<p class="chorus"><strong>CORO:</strong><br>${highlightText(result.chorus.replace(/\n/g, '<br>'), currentState.lastQuery)}</p>`;
            }
            if (result.stanzas) {
                result.stanzas.forEach((stanza, i) => {
                    content += `<p><strong>${i + 1}.</strong> ${highlightText(stanza.replace(/\n/g, '<br>'), currentState.lastQuery)}</p>`;
                    if (!result.startsWithChorus && result.chorus) {
                        content += `<p class="chorus"><strong>CORO:</strong><br>${highlightText(result.chorus.replace(/\n/g, '<br>'), currentState.lastQuery)}</p>`;
                    }
                });
            }
            html = content;
        }
        
        singleResultContent.innerHTML = html;
        updateNavigationButtons();
        updateView('single');
    }

    async function displayBibleChapter(bookKey, chapterNum) {
        const bookData = await loadBibleBookData(bookKey);
        const bookInfo = bibleIndex.find(b => b.key === bookKey);
        
        if (!bookData || !bookInfo || chapterNum < 1 || chapterNum > bookInfo.chapters) {
            chapterContent.innerHTML = `<p>Referencia no encontrada.</p>`;
            readViewTitle.textContent = "Error";
            updateView('read');
            return;
        }

        currentState.bookKey = bookKey;
        currentState.chapter = chapterNum;
        currentState.verse = null;
        currentState.verseCount = bookData[chapterNum - 1].length;

        let html = bookData[chapterNum - 1].map((verseText, index) => 
            `<p><strong>${index + 1}</strong> ${verseText}</p>`
        ).join('');
        
        chapterContent.innerHTML = html;
        readViewTitle.textContent = `${bookInfo.title} ${chapterNum}`;
        updateNavigationButtons();
        updateView('read');
        updateReferenceSelectors(bookKey, chapterNum);
    }
    
    async function displayBibleVerses(bookKey, chapterNum, startVerse, endVerse = startVerse) {
        const bookData = await loadBibleBookData(bookKey);
        const bookInfo = bibleIndex.find(b => b.key === bookKey);
    
        if (!bookData || !bookInfo || chapterNum < 1 || chapterNum > bookInfo.chapters || startVerse < 1 || endVerse > bookData[chapterNum - 1].length) {
            chapterContent.innerHTML = `<p>Referencia no encontrada.</p>`;
            readViewTitle.textContent = "Error";
            updateView('read');
            return;
        }
    
        currentState.bookKey = bookKey;
        currentState.chapter = chapterNum;
        currentState.verse = startVerse;
        currentState.verseCount = bookData[chapterNum - 1].length;
    
        let html = '';
        for (let i = startVerse - 1; i < endVerse; i++) {
            html += `<p><strong>${i + 1}</strong> ${bookData[chapterNum - 1][i]}</p>`;
        }
        
        chapterContent.innerHTML = html;
        readViewTitle.textContent = `${bookInfo.title} ${chapterNum}:${startVerse}${startVerse !== endVerse ? '-' + endVerse : ''}`;
        updateNavigationButtons();
        updateView('read');
        updateReferenceSelectors(bookKey, chapterNum, startVerse);
    }
    
    // --- LÓGICA DE NAVEGACIÓN ---
    async function navigateChapter(direction) {
        if (!currentState.bookKey) return;
        const bookInfo = bibleIndex.find(b => b.key === currentState.bookKey);
        const newChapter = currentState.chapter + direction;
        if (newChapter >= 1 && newChapter <= bookInfo.chapters) {
            await displayBibleChapter(currentState.bookKey, newChapter);
        }
    }

    async function navigateVerse(direction) {
        if (!currentState.bookKey || !currentState.chapter) return;
        
        let { bookKey, chapter, verse, verseCount } = currentState;
        let newVerse = (verse || (direction > 0 ? 0 : verseCount + 1)) + direction;
        let bookInfo = bibleIndex.find(b => b.key === bookKey);
    
        if (newVerse >= 1 && newVerse <= verseCount) {
            await displayBibleVerses(bookKey, chapter, newVerse);
        } else if (newVerse < 1) { // Ir al capítulo anterior
            if (chapter > 1) {
                const prevChapterNum = chapter - 1;
                const prevBookData = await loadBibleBookData(bookKey);
                const lastVersePrevChapter = prevBookData[prevChapterNum - 1].length;
                await displayBibleChapter(bookKey, prevChapterNum);
                // Opcional: ir al último versículo del capítulo anterior
                // await displayBibleVerses(bookKey, prevChapterNum, lastVersePrevChapter);
            }
        } else if (newVerse > verseCount) { // Ir al capítulo siguiente
            if (chapter < bookInfo.chapters) {
                await displayBibleChapter(bookKey, chapter + 1);
                 // Opcional: ir al primer versículo del capítulo siguiente
                // await displayBibleVerses(bookKey, chapter + 1, 1);
            }
        }
    }

    function navigateSearchResult(direction) {
        const newIndex = currentState.searchResultIndex + direction;
        if (newIndex >= 0 && newIndex < currentState.searchResults.length) {
            displaySingleSearchResult(newIndex);
        }
    }
    
    function updateNavigationButtons() {
        const { bookKey, chapter, verse, searchResultIndex, searchResults, view } = currentState;
        const bookInfo = bookKey ? bibleIndex.find(b => b.key === bookKey) : null;
        
        // Ocultar/mostrar botones según la vista
        readView.querySelector('.navigation-buttons').style.display = view === 'read' ? 'flex' : 'none';
        singleResultView.querySelector('.navigation-buttons').style.display = view === 'single' ? 'flex' : 'none';

        if (view === 'read' && bookInfo) {
            prevChapterBtn.disabled = chapter <= 1 && bookInfo.id === 1;
            nextChapterBtn.disabled = chapter >= bookInfo.chapters && bookInfo.id === bibleIndex.length;

            const isShowingChapter = verse === null;
            prevVerseBtn.style.display = isShowingChapter ? 'none' : 'inline-block';
            nextVerseBtn.style.display = isShowingChapter ? 'none' : 'inline-block';
            
            const firstVerseInBook = chapter === 1 && verse === 1;
            const lastVerseInBook = chapter === bookInfo.chapters && verse === currentState.verseCount;

            prevVerseBtn.disabled = firstVerseInBook;
            nextVerseBtn.disabled = lastVerseInBook;

        } else if (view === 'single') {
            prevSearchResultBtn.disabled = searchResultIndex <= 0;
            nextSearchResultBtn.disabled = searchResultIndex >= searchResults.length - 1;
        }
    }
    
    // --- CONTROLES DE REFERENCIA (SELECTS) ---
    async function setupReferenceNavigation() {
        if (bibleIndex.length > 0) {
            bibleIndex.forEach(book => {
                const option = document.createElement('option');
                option.value = book.key;
                option.textContent = book.title;
                bookSelect.appendChild(option);
            });
            bookSelect.disabled = false;
        }

        bookSelect.addEventListener('change', async () => {
            const selectedBookKey = bookSelect.value;
            chapterSelect.value = '';
            verseSelect.value = '';
            await fillChapterSelect(selectedBookKey);
            verseSelect.innerHTML = '<option value="">(Opcional) Versículo</option>';
            verseSelect.disabled = true;
            updateGoButtonState();
        });

        chapterSelect.addEventListener('change', async () => {
            const selectedBookKey = bookSelect.value;
            const selectedChapter = parseInt(chapterSelect.value, 10);
            verseSelect.value = '';
            await fillVerseSelect(selectedBookKey, selectedChapter);
            updateGoButtonState();
        });

        verseSelect.addEventListener('change', updateGoButtonState);
    }

    function goToReference() {
        const bookKey = bookSelect.value;
        const chapter = parseInt(chapterSelect.value, 10);
        const verse = verseSelect.value ? parseInt(verseSelect.value, 10) : null;
    
        if (bookKey && chapter) {
            if (verse) {
                displayBibleVerses(bookKey, chapter, verse);
            } else {
                displayBibleChapter(bookKey, chapter);
            }
        }
    }

    function updateGoButtonState() {
        goToReferenceBtn.disabled = !(bookSelect.value && chapterSelect.value);
    }
    
    async function fillChapterSelect(bookKey, selectedChapter = null) {
        chapterSelect.innerHTML = '<option value="">Selecciona capítulo</option>';
        chapterSelect.disabled = true;
        if (bookKey) {
            const bookInfo = bibleIndex.find(b => b.key === bookKey);
            if (bookInfo) {
                for (let i = 1; i <= bookInfo.chapters; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `Capítulo ${i}`;
                    chapterSelect.appendChild(option);
                }
                chapterSelect.disabled = false;
                if (selectedChapter) chapterSelect.value = selectedChapter;
            }
        }
    }
    
    async function fillVerseSelect(bookKey, chapterNum, selectedVerse = null) {
        verseSelect.innerHTML = '<option value="">(Opcional) Versículo</option>';
        verseSelect.disabled = true;
        if (bookKey && chapterNum) {
            const bookData = await loadBibleBookData(bookKey);
            if (bookData && bookData[chapterNum - 1]) {
                const verseCount = bookData[chapterNum - 1].length;
                for (let i = 1; i <= verseCount; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `Versículo ${i}`;
                    verseSelect.appendChild(option);
                }
                verseSelect.disabled = false;
                if (selectedVerse) verseSelect.value = selectedVerse;
            }
        }
    }

    async function updateReferenceSelectors(bookKey, chapter, verse) {
        if (bookSelect.value !== bookKey) {
            bookSelect.value = bookKey;
            await fillChapterSelect(bookKey, chapter);
            await fillVerseSelect(bookKey, chapter, verse);
        } else if (chapterSelect.value !== chapter.toString()) {
            chapterSelect.value = chapter;
            await fillVerseSelect(bookKey, chapter, verse);
        }
        
        if (verse) {
             verseSelect.value = verse;
        } else {
            verseSelect.value = "";
        }

        updateGoButtonState();
    }

    // --- FUNCIONES DE UTILIDAD ---
    function highlightText(text, query) {
        if (!query || typeof text !== 'string') return text;
        const terms = query.replace(/"/g, '').split(/\s+/).filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (terms.length === 0) return text;
        const regex = new RegExp(`(${terms.join('|')})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('Texto copiado al portapapeles.');
        } catch (err) {
            alert('Error al copiar el texto.');
            console.error('Error al copiar: ', err);
        }
    }
    
    // MEJORADO: Usa innerText para una copia más limpia y fiel al formato visual.
    function getTextFromHtml(element) {
        return element.innerText;
    }

    function copyReadViewContent() {
        const title = readViewTitle.textContent;
        const content = getTextFromHtml(chapterContent);
        copyToClipboard(`${title}\n\n${content}`);
    }

    function copySingleViewContent() {
        const title = singleViewTitle.textContent;
        const content = getTextFromHtml(singleResultContent);
        copyToClipboard(`${title}\n\n${content}`);
    }

    async function shareContent(title, text) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: `${title}\n\n${text}\n\n- Compartido desde NA.BIBLE`,
                });
            } catch (err) {
                // No mostrar error si el usuario cancela el diálogo de compartir
                if (err.name !== 'AbortError') {
                    console.error('Error al compartir:', err);
                }
            }
        } else {
            alert('La función de compartir no está disponible en este navegador. Intenta copiar el texto.');
        }
    }
    
    function shareReadViewContent() {
        const title = readViewTitle.textContent;
        const text = getTextFromHtml(chapterContent);
        shareContent(title, text);
    }
    
    function shareSingleViewContent() {
        const title = singleViewTitle.textContent;
        const text = getTextFromHtml(singleResultContent);
        shareContent(title, text);
    }

    // --- LÓGICA DEL TEMA OSCURO ---
    function setupTheme() {
        const themeIcon = document.getElementById('theme-icon');
        const body = document.body;
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
        const storedTheme = localStorage.getItem('theme');

        function applyTheme(theme) {
            if (theme === 'dark') {
                body.classList.add('dark-mode');
                themeIcon.textContent = '☀️';
            } else {
                body.classList.remove('dark-mode');
                themeIcon.textContent = '🌙';
            }
        }

        if (storedTheme) {
            applyTheme(storedTheme);
        } else {
            applyTheme(prefersDarkMode.matches ? 'dark' : 'light');
        }

        themeToggle.addEventListener('click', () => {
            const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // --- Iniciar la Aplicación ---
    initializeApp();
});