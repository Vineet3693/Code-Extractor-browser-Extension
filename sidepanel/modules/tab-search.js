// ============================================================
// tab-search.js — Search Tab: universal search across projects
// ============================================================

async function performUniversalSearch() {
    const input = document.getElementById('universal-search-input');
    const searchResults = document.getElementById('search-results');
    const searchTypeFilter = document.getElementById('search-type-filter');
    const searchLangFilter = document.getElementById('search-lang-filter');
    const searchSort = document.getElementById('search-sort');
    if (!input || !searchResults) return;
    const query = input.value.trim();
    if (!query) return;
    searchResults.innerHTML = '<p class="empty-state">Searching...</p>';
    try {
        if (CE.universalSearch && CE.universalSearch.isIndexed) {
            const response = await CE.universalSearch.search(query, {
                type: searchTypeFilter?.value, sortBy: searchSort?.value, language: searchLangFilter?.value || null
            });
            if (response.results.length > 0) {
                renderSearchResults(response.results, query);
                await CE.universalSearch.saveSearch(query, response.totalMatches);
            } else {
                searchResults.innerHTML = '<p class="empty-state">No results found.</p>';
            }
        } else {
            const response = await chrome.runtime.sendMessage({
                action: 'UNIVERSAL_SEARCH',
                data: { query, type: searchTypeFilter?.value, sortBy: searchSort?.value }
            });
            if (response.success) renderSearchResults(response.results, query);
            else searchResults.innerHTML = '<p class="empty-state">Search failed.</p>';
        }
    } catch (error) {
        searchResults.innerHTML = '<p class="empty-state">Search error.</p>';
    }
}

function renderSearchResults(results, query) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;
    if (results.length === 0) { searchResults.innerHTML = '<p class="empty-state">No results found.</p>'; return; }
    searchResults.innerHTML = '';
    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
      <div class="search-result-header">
        <span class="search-result-type">${result.type === 'project' ? '📁' : '📄'} ${result.type}</span>
        <span class="search-result-name">${highlightText(result.name || result.fileName || '', query)}</span>
      </div>
      <div class="search-result-meta">
        ${result.language ? `<span class="lang-badge">${result.language}</span>` : ''}
        ${result.sourceSite ? `<span>${result.sourceSite}</span>` : ''}
        ${result.totalFiles ? `<span>${result.totalFiles} files</span>` : ''}
        ${result.size ? `<span>${formatBytes(result.size)}</span>` : ''}
      </div>
      ${result.snippet ? `<div class="search-result-snippet">${highlightText(result.snippet, query)}</div>` : ''}
    `;
        searchResults.appendChild(div);
    });
}

function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadSearchLanguages() {
    const searchLangFilter = document.getElementById('search-lang-filter');
    if (!searchLangFilter) return;
    try {
        if (CE.universalSearch && CE.universalSearch.isIndexed) {
            const languages = await CE.universalSearch.getPopularLanguages();
            searchLangFilter.innerHTML = '<option value="">All Languages</option>';
            languages.forEach(({ language, count }) => {
                const option = document.createElement('option');
                option.value = language;
                option.textContent = `${language.charAt(0).toUpperCase() + language.slice(1)} (${count})`;
                searchLangFilter.appendChild(option);
            });
        } else {
            const response = await chrome.runtime.sendMessage({ action: 'GET_PROJECTS' });
            if (response.success && response.data) {
                const languages = new Set();
                response.data.forEach(p => { if (p.languages) p.languages.forEach(l => languages.add(l)); });
                searchLangFilter.innerHTML = '<option value="">All Languages</option>';
                languages.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang;
                    option.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
                    searchLangFilter.appendChild(option);
                });
            }
        }
    } catch (e) { }
}
