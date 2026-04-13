# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

### Added
- Core scanning engine with 10-step pipeline
- 9 site-specific parsers (ChatGPT, Claude, Gemini, Outlier, Mistral, Poe, GitHub, Stack Overflow, Generic)
- Smart file name detection with 5 strategies (header, surrounding text, comments, tree match, content analysis)
- Language identification for 60+ languages with weighted confidence scoring
- ASCII tree structure parsing (├── └── format)
- Project mapping with fuzzy matching and language-based ordering
- Duplicate file handling (keep latest, keep all, merge strategies)
- ZIP generation with JSZip including nested directories
- Auto-generated README.md with project structure and getting started guides
- Auto-generated .gitignore based on detected languages
- Auto-generated dependency files (requirements.txt, package.json, go.mod)
- IndexedDB storage for project history
- Chrome Storage Sync for settings persistence
- Project save, load, search, and delete
- Data export/import (JSON backup/restore)
- Popup UI with 7 states (initial, scanning, results, file detail, settings, history, unmapped)
- Side panel for larger workspace view
- Dark and light theme support with system preference detection
- Toast notifications for user feedback
- Interactive tree view component
- Code preview with line numbers and copy button
- File editor with autocomplete and validation
- Progress bar with step indicators
- Modal dialogs (confirm, alert, prompt)
- Search bar with debounced filtering
- Theme manager with auto-detection
- Content script injection with copy buttons and FAB
- Right-click context menu integration
- Keyboard shortcuts (Ctrl+Shift+E, Ctrl+Shift+S)
- Comprehensive error handling with graceful degradation
- Input sanitization and security measures
- Privacy-first design (100% local, no tracking)
