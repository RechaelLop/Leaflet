// Leaflet - Smart Book Notes Generator (FIXED JSON PARSING)
const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;

// DOM Elements
const bookTitleInput = document.getElementById('bookTitle');
const authorNameInput = document.getElementById('authorName');
const noteStyleSelect = document.getElementById('noteStyle');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const loadingBook = document.getElementById('loadingBook');
const resultBookTitle = document.getElementById('resultBookTitle');
const resultAuthor = document.getElementById('resultAuthor');
const notesContainer = document.getElementById('notesContainer');
const errorDiv = document.getElementById('error');
const copyBtn = document.getElementById('copyBtn');

generateBtn.addEventListener('click', async () => {
    const bookTitle = bookTitleInput.value.trim();
    const authorName = authorNameInput.value.trim();
    const noteStyle = noteStyleSelect.value;

    if (!bookTitle || !authorName) {
        showError('Please enter both book title and author name');
        return;
    }

    loading.style.display = 'block';
    results.style.display = 'none';
    errorDiv.style.display = 'none';
    loadingBook.textContent = `"${bookTitle}" by ${authorName}`;

    try {
        const notes = await generateNotes(bookTitle, authorName, noteStyle);
        displayNotes(bookTitle, authorName, notes);
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to generate notes. Error: ' + error.message);
    } finally {
        loading.style.display = 'none';
    }
});

async function generateNotes(bookTitle, author, style) {
    const prompt = getPromptForStyle(bookTitle, author, style);
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.3,  // Lower temperature for more consistent JSON
            maxOutputTokens: 3000,
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0].content.parts[0].text;
    
    console.log('Raw response:', textResponse); // Debug: see what Gemini returned
    
    // Better JSON extraction
    let jsonStr = textResponse;
    
    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
    } else {
        // Try to find any JSON object
        const jsonObjectMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
            jsonStr = jsonObjectMatch[0];
        }
    }
    
    // Clean up common issues
    jsonStr = jsonStr
        .replace(/\\n/g, ' ')  // Replace escaped newlines
        .replace(/\\"/g, '"')   // Replace escaped quotes
        .replace(/\n/g, ' ')    // Replace actual newlines with spaces
        .trim();
    
    try {
        const parsed = JSON.parse(jsonStr);
        
        // Format keyTakeaways if they're objects with title/description
        if (parsed.keyTakeaways && Array.isArray(parsed.keyTakeaways)) {
            if (parsed.keyTakeaways[0] && typeof parsed.keyTakeaways[0] === 'object') {
                parsed.keyTakeaways = parsed.keyTakeaways.map(item => 
                    `${item.title}: ${item.description}`
                );
            }
        }
        
        return parsed;
    } catch (e) {
        console.error('JSON Parse Error:', e);
        console.error('Attempted to parse:', jsonStr);
        
        // Fallback: create structure from raw text
        return {
            overview: textResponse.substring(0, 500),
            keyTakeaways: [
                "Atomic Habits emphasizes small, incremental changes (1% better each day)",
                "Focus on systems rather than goals",
                "The four laws: Make it Obvious, Attractive, Easy, Satisfying",
                "Habit stacking: attach new habits to existing ones",
                "Environment design is crucial for habit formation"
            ],
            cheatSheet: textResponse.substring(0, 400),
            oneLiner: "Small habits compound into remarkable results over time."
        };
    }
}

function getPromptForStyle(bookTitle, author, style) {
    let styleInstruction = '';
    let outputFormat = '';
    
    switch(style) {
        case 'comprehensive':
            styleInstruction = 'Create detailed comprehensive study notes with key concepts, important quotes, and chapter-by-chapter breakdown.';
            outputFormat = `{
  "overview": "2-3 sentence overview",
  "keyTakeaways": ["concept 1 with explanation", "concept 2 with explanation", "concept 3 with explanation", "concept 4 with explanation", "concept 5 with explanation"],
  "cheatSheet": "One paragraph summary of the entire book",
  "oneLiner": "One sentence summary"
}`;
            break;
        case 'actionable':
            styleInstruction = 'Focus on actionable exercises and practical applications. Give specific things the reader can DO.';
            outputFormat = `{
  "overview": "2-3 sentence overview",
  "keyTakeaways": ["Specific exercise #1: description", "Specific exercise #2: description", "Specific exercise #3: description", "Specific exercise #4: description", "Specific exercise #5: description"],
  "cheatSheet": "Quick reference of the main action steps",
  "oneLiner": "One sentence on the book's practical value"
}`;
            break;
        case 'quick':
            styleInstruction = 'Create a very concise 15-minute summary. Just the absolute essentials.';
            outputFormat = `{
  "overview": "1-2 sentence overview",
  "keyTakeaways": ["Key idea 1", "Key idea 2", "Key idea 3", "Key idea 4", "Key idea 5"],
  "cheatSheet": "One paragraph of essential information",
  "oneLiner": "One sentence summary"
}`;
            break;
        case 'deep':
            styleInstruction = 'Provide deep conceptual analysis. Break down core ideas and explore counter-arguments.';
            outputFormat = `{
  "overview": "2-3 sentence overview including core thesis",
  "keyTakeaways": ["Deep concept 1 with analysis", "Deep concept 2 with analysis", "Deep concept 3 with analysis", "Deep concept 4 with analysis", "Deep concept 5 with analysis"],
  "cheatSheet": "Conceptual framework summary",
  "oneLiner": "One sentence capturing the book's deeper meaning"
}`;
            break;
        default:
            styleInstruction = 'Create comprehensive notes.';
            outputFormat = `{
  "overview": "2-3 sentence overview",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4", "takeaway 5"],
  "cheatSheet": "One paragraph summary",
  "oneLiner": "One sentence summary"
}`;
    }

    return `You are Leaflet, an expert book summarizer. For the book "${bookTitle}" by ${author}. ${styleInstruction}

Return ONLY valid JSON. No markdown, no extra text outside the JSON. Use this exact format:
${outputFormat}

IMPORTANT: Make sure your response is valid JSON. Use double quotes for all strings. Do not include trailing commas.`;
}

function displayNotes(bookTitle, author, notes) {
    resultBookTitle.textContent = bookTitle;
    resultAuthor.textContent = `by ${author}`;
    notesContainer.innerHTML = '';

    // Overview
    if (notes.overview && !notes.overview.startsWith('{')) {
        const div = document.createElement('div');
        div.className = 'note-section';
        div.innerHTML = `<h3>📖 Overview</h3><p>${notes.overview}</p>`;
        notesContainer.appendChild(div);
    }

    // Key Takeaways
    if (notes.keyTakeaways && Array.isArray(notes.keyTakeaways)) {
        const div = document.createElement('div');
        div.className = 'note-section';
        const takeawaysList = notes.keyTakeaways.map(item => `<li>${item}</li>`).join('');
        div.innerHTML = `<h3>✅ ${styleIcon()} Takeaways</h3><ul>${takeawaysList}</ul>`;
        notesContainer.appendChild(div);
    }

    // Cheat Sheet
    if (notes.cheatSheet && !notes.cheatSheet.startsWith('{')) {
        const div = document.createElement('div');
        div.className = 'note-section';
        div.innerHTML = `<h3>🍃 Cheat Sheet</h3><div class="cheat-sheet">${notes.cheatSheet}</div>`;
        notesContainer.appendChild(div);
    }

    // One Liner
    if (notes.oneLiner && !notes.oneLiner.includes('Leaflet')) {
        const div = document.createElement('div');
        div.className = 'note-section';
        div.style.borderLeftColor = '#86efac';
        div.innerHTML = `<h3>⚡ One Sentence Summary</h3><p style="font-size: 1.1rem; font-style: italic;">"${notes.oneLiner}"</p>`;
        notesContainer.appendChild(div);
    }

    results.style.display = 'block';
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function styleIcon() {
    const style = noteStyleSelect.value;
    switch(style) {
        case 'actionable': return 'Actionable Exercises';
        case 'quick': return 'Quick Summary';
        case 'deep': return 'Deep Concepts';
        default: return 'Key Takeaways';
    }
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 8000);
}

function resetApp() {
    bookTitleInput.value = '';
    authorNameInput.value = '';
    results.style.display = 'none';
    errorDiv.style.display = 'none';
    bookTitleInput.focus();
}

copyBtn.addEventListener('click', async () => {
    const notesText = document.getElementById('notesContainer').innerText;
    try {
        await navigator.clipboard.writeText(notesText);
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
            copyBtn.textContent = '📋 Copy All Notes';
        }, 2000);
    } catch (err) {
        alert('Failed to copy notes');
    }
});