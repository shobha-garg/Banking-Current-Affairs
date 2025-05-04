let questions = [];
let order = [];
let current = 0;
let randomize = false;
let flaggedMode = false;
let selectedCategory = null;
let answeredCorrectly = new Set(); // Track questions answered correctly
let history = []; // Track question navigation history
let statsCache = null; // Cache stats to avoid redundant API calls
const LOAD_TIMEOUT = 10000; // 10 seconds timeout for loading data

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Setup category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.dataset.category;
            flaggedMode = false;
            document.getElementById('flagged-btn').classList.remove('active');
            loadQuestions(selectedCategory);
        });
    });
    
    // Setup randomize button
    const randomizeBtn = document.getElementById('randomize-btn');
    randomizeBtn.addEventListener('click', toggleRandomize);
    
    // Setup flagged questions button
    const flaggedBtn = document.getElementById('flagged-btn');
    flaggedBtn.addEventListener('click', toggleFlaggedQuestions);
    
    // Setup navigation buttons
    document.getElementById('back-btn').addEventListener('click', () => {
        goToPreviousQuestion();
    });
    
    // Setup flag button
    document.getElementById('flag-btn').addEventListener('click', toggleFlag);
    
    // Setup stats modal
    document.getElementById('statsModal').addEventListener('show.bs.modal', loadStats);
    
    // Setup load data button
    document.getElementById('load-data-btn').addEventListener('click', loadData);
    
    // Check if we have any stats already, if not then load the data automatically
    checkAndLoadInitialData();
});

// Check if there's any data in the database, if not, load it automatically
async function checkAndLoadInitialData() {
    try {
        const response = await fetch('/stats', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        statsCache = await response.json();
        
        // Check if we have any questions in any category
        const totalQuestions = Object.values(statsCache).reduce((sum, category) => sum + category.total, 0);
        
        if (totalQuestions === 0) {
            console.log("No questions found in database, loading initial data...");
            await loadData();
        } else {
            // Auto-select the first category if data exists
            const firstCategory = document.querySelector('.category-btn');
            if (firstCategory) {
                firstCategory.click();
            }
        }
    } catch (err) {
        console.error("Error checking stats:", err);
        showFeedback('Failed to check data. Attempting to load data...', 'warning');
        await loadData();
    }
}

// Toggle between all questions and flagged questions
async function toggleFlaggedQuestions() {
    if (!selectedCategory) {
        showFeedback('Please select a category first.', 'warning');
        return;
    }
    
    flaggedMode = !flaggedMode;
    document.getElementById('flagged-btn').classList.toggle('active', flaggedMode);
    
    if (flaggedMode) {
        try {
            showLoading(true, `Loading flagged questions...`);
            
            const response = await fetch(`/api/flagged-questions/${selectedCategory}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Failed to fetch flagged questions');
            }
            
            questions = await response.json();
            
            if (questions.length === 0) {
                showLoading(false);
                document.getElementById('question-area').innerHTML = 
                    `<div class='text-center text-white'>No flagged questions found for this category.</div>`;
                return;
            }
            
            // Reset quiz state
            current = 0;
            history = [];
            answeredCorrectly.clear();
            
            // Create new order
            order = [...Array(questions.length).keys()];
            if (randomize) {
                shuffle(order);
            }
            
            // Update category title
            document.getElementById('category-title').textContent = 
                `Flagged Questions: ${document.querySelector(`.category-btn[data-category="${selectedCategory}"]`).textContent}`;
            
            showLoading(false);
            renderQuestion();
        } catch (err) {
            console.error(err);
            showLoading(false);
            document.getElementById('question-area').innerHTML = 
                "<div class='text-center text-danger'>Could not load flagged questions.<br>Please try again.</div>";
            showFeedback('Failed to load flagged questions.', 'error');
        }
    } else {
        // Go back to all questions
        document.getElementById('category-title').textContent = 
            document.querySelector(`.category-btn[data-category="${selectedCategory}"]`).textContent;
        loadQuestions(selectedCategory);
    }
}

// Load questions for a category
async function loadQuestions(category) {
    try {
        showLoading(true, `Loading ${category} questions...`);
        
        const response = await fetch(`/api/questions/${category}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Failed to fetch questions');
        }
        
        questions = await response.json();
        
        if (questions.length === 0) {
            showLoading(false);
            document.getElementById('question-area').innerHTML = 
                `<div class='text-center text-danger'>No questions found for ${category}.</div>`;
            return;
        }
        
        // Reset quiz state
        current = 0;
        history = [];
        answeredCorrectly.clear();
        
        // Create new order
        order = [...Array(questions.length).keys()];
        if (randomize) {
            shuffle(order);
        }
        
        // Update category title
        document.getElementById('category-title').textContent = 
            document.querySelector(`.category-btn[data-category="${category}"]`).textContent;
        
        // Enable buttons
        document.getElementById('flag-btn').disabled = false;
        
        // Clear feedback area
        clearFeedback();
        
        showLoading(false);
        renderQuestion();
    } catch (err) {
        console.error(err);
        showLoading(false);
        document.getElementById('question-area').innerHTML = 
            "<div class='text-center text-danger'>Could not load questions.<br>Please try again.</div>";
        showFeedback('Failed to load questions.', 'error');
    }
}

function showLoading(isLoading, message = 'Loading...') {
    const loadingMessage = document.getElementById('loading-message');
    
    if (isLoading) {
        document.getElementById('question-area').innerHTML = `
            <div class="text-center loading" id="loading-message">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>${message}</p>
            </div>
        `;
    }
}

// Render current question
function renderQuestion() {
    if (!questions.length) return;
    
    // Get the current question using the order array
    const questionIndex = order[current];
    const question = questions[questionIndex];
    
    // Update the question counter and progress bar
    document.getElementById('question-counter').textContent = `${current + 1}/${questions.length}`;
    const progressPercent = ((current + 1) / questions.length) * 100;
    document.querySelector('.progress-bar').style.width = `${progressPercent}%`;
    
    // Enable/disable back button based on history
    document.getElementById('back-btn').disabled = history.length === 0;
    
    // Update flag button state
    const flagBtn = document.getElementById('flag-btn');
    flagBtn.classList.toggle('flagged', question.flagged);
    if (question.flagged) {
        flagBtn.innerHTML = '<i class="fas fa-flag"></i> Flagged';
    } else {
        flagBtn.innerHTML = '<i class="far fa-flag"></i> Flag';
    }
    
    // Apply swipe animation
    const questionArea = document.getElementById('question-area');
    questionArea.classList.add('swipe-left');
    
    // Create the question content with a slight delay for animation
    setTimeout(() => {
        // Remove the swipe animation class
        questionArea.classList.remove('swipe-left');
        questionArea.classList.add('swipe-right');
        
        // Create question content
        let content = `
            <div class="question-meta">
                <span>Question ${current + 1} of ${questions.length}</span>
                ${question.flagged ? '<span class="flagged-question"><i class="fas fa-flag"></i> Flagged</span>' : ''}
            </div>
            <div id="question-text">${question.question}</div>
            <div class="options-container">
        `;
        
        // Add options
        const options = [
            { label: 'A', value: 'option_a', text: question.option_a },
            { label: 'B', value: 'option_b', text: question.option_b },
            { label: 'C', value: 'option_c', text: question.option_c },
            { label: 'D', value: 'option_d', text: question.option_d }
        ];
        
        options.forEach(option => {
            // Check if this question has already been answered correctly
            const isAnsweredCorrectly = answeredCorrectly.has(question.id);
            const isCorrect = option.label === question.correct_option;
            
            let buttonClass = 'option-btn';
            if (isAnsweredCorrectly && isCorrect) {
                buttonClass += ' correct';
            }
            
            content += `
                <button class="${buttonClass}" data-option="${option.label}">
                    <span class="option-label">${option.label}</span>
                    ${option.text}
                </button>
            `;
        });
        
        content += `</div>`;
        
        // Set the content
        questionArea.innerHTML = content;
        
        // Add event listeners to the options
        document.querySelectorAll('.option-btn').forEach(button => {
            button.addEventListener('click', (e) => handleOptionClick(e));
        });
        
        // Remove the swipe animation after it completes
        setTimeout(() => {
            questionArea.classList.remove('swipe-right');
        }, 300);
        
    }, 300);
}

// Handle option click
async function handleOptionClick(e) {
    const selectedOption = e.currentTarget.getAttribute('data-option');
    const questionIndex = order[current];
    const question = questions[questionIndex];
    
    // Check if question has already been answered correctly
    if (answeredCorrectly.has(question.id)) {
        // If already answered correctly, allow navigation to next question
        if (current < questions.length - 1) {
            history.push(current);
            current++;
            renderQuestion();
        } else {
            showFeedback('Quiz completed! You have answered all questions correctly.', 'success');
        }
        return;
    }
    
    // Send answer to server for verification
    try {
        const response = await fetch('/api/check-answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question_id: question.id,
                category: selectedCategory,
                selected_option: selectedOption
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit answer');
        }
        
        const data = await response.json();
        
        // Handle result
        if (data.is_correct) {
            // Correct answer
            // Mark this question as answered correctly
            answeredCorrectly.add(question.id);
            
            // Highlight the correct option
            document.querySelectorAll('.option-btn').forEach(btn => {
                if (btn.getAttribute('data-option') === selectedOption) {
                    btn.classList.add('correct');
                }
            });
            
            // Show success feedback
            showFeedback('Correct! Well done.', 'success');
            
            // Move to next question after a short delay
            setTimeout(() => {
                if (current < questions.length - 1) {
                    history.push(current);
                    current++;
                    renderQuestion();
                } else {
                    showFeedback('Quiz completed! You have answered all questions correctly.', 'success');
                }
            }, 1000);
        } else {
            // Incorrect answer
            // Highlight the incorrect option temporarily
            document.querySelectorAll('.option-btn').forEach(btn => {
                if (btn.getAttribute('data-option') === selectedOption) {
                    btn.classList.add('incorrect');
                    
                    // Remove the incorrect class after a delay
                    setTimeout(() => {
                        btn.classList.remove('incorrect');
                    }, 1000);
                }
            });
            
            // Show error feedback
            showFeedback('Oops, Answer is incorrect, try again.', 'error');
            // Do not reveal the correct answer and do not proceed to the next question
        }
    } catch (err) {
        console.error(err);
        showFeedback('Error checking answer. Please try again.', 'error');
    }
}

// Go to previous question
function goToPreviousQuestion() {
    if (history.length === 0) return;
    
    // Get the last question from history
    current = history.pop();
    renderQuestion();
}

// Toggle randomize mode
function toggleRandomize() {
    randomize = !randomize;
    document.getElementById('randomize-btn').classList.toggle('active', randomize);
    
    if (selectedCategory && questions.length > 0) {
        // Re-shuffle the order
        if (randomize) {
            shuffle(order);
        } else {
            // Reset to sequential order
            order = [...Array(questions.length).keys()];
        }
        
        // Reset state
        current = 0;
        history = [];
        answeredCorrectly.clear();
        
        // Render first question
        renderQuestion();
    }
}

// Toggle flag for current question
async function toggleFlag() {
    if (!questions.length) return;
    
    const questionIndex = order[current];
    const question = questions[questionIndex];
    
    try {
        const response = await fetch('/api/flag-question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question_id: question.id,
                category: selectedCategory,
                flagged: !question.flagged
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to flag question');
        }
        
        const data = await response.json();
        
        // Update the question object
        question.flagged = data.flagged;
        
        // Update the UI
        const flagBtn = document.getElementById('flag-btn');
        flagBtn.classList.toggle('flagged', question.flagged);
        if (question.flagged) {
            flagBtn.innerHTML = '<i class="fas fa-flag"></i> Flagged';
            showFeedback('Question flagged for later review.', 'success');
        } else {
            flagBtn.innerHTML = '<i class="far fa-flag"></i> Flag';
            showFeedback('Flag removed.', 'success');
        }
        
        // Update the question meta
        const questionMeta = document.querySelector('.question-meta');
        if (questionMeta) {
            const flaggedSpan = questionMeta.querySelector('.flagged-question');
            if (question.flagged && !flaggedSpan) {
                questionMeta.innerHTML += '<span class="flagged-question"><i class="fas fa-flag"></i> Flagged</span>';
            } else if (!question.flagged && flaggedSpan) {
                flaggedSpan.remove();
            }
        }
        
        // Update stats cache
        statsCache = null; // Invalidate cache
    } catch (err) {
        console.error(err);
        showFeedback('Error flagging question. Please try again.', 'error');
    }
}

// Load statistics
async function loadStats() {
    const statsBody = document.getElementById('stats-body');
    statsBody.innerHTML = `
        <div class="text-center loading">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading statistics...</p>
        </div>
    `;
    
    try {
        if (statsCache) {
            // Use cached stats if available
            renderStats(statsCache);
            return;
        }
        
        const response = await fetch('/stats', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Failed to load stats');
        }
        statsCache = await response.json();
        renderStats(statsCache);
    } catch (err) {
        console.error(err);
        statsBody.innerHTML = '<p class="text-center text-danger">Failed to load statistics.</p>';
    }
}

function renderStats(stats) {
    const statsBody = document.getElementById('stats-body');
    let html = '';
    
    for (const [category, data] of Object.entries(stats)) {
        // Get the display name for the category
        const displayName = document.querySelector(`.category-btn[data-category="${category}"]`)?.textContent || category;
        
        html += `
            <div class="stats-card">
                <h5>${displayName}</h5>
                <div class="stats-number">${data.total}</div>
                <div class="stats-detail">
                    <div class="stats-detail-item">
                        <i class="fas fa-list"></i> Total Questions
                    </div>
                    <div class="stats-detail-item">
                        <i class="fas fa-flag"></i> Flagged: ${data.flagged}
                    </div>
                </div>
            </div>
        `;
    }
    
    statsBody.innerHTML = html || '<p class="text-center">No statistics available.</p>';
}

// Load data from text files into the database
async function loadData() {
    const loadingModal = document.getElementById('loadingDataModal');
    let bsModal;
    
    try {
        // Initialize the modal
        if (loadingModal) {
            bsModal = new bootstrap.Modal(loadingModal, {
                backdrop: 'static',
                keyboard: false
            });
            bsModal.show();
        }
        
        // Set a timeout to hide the modal if loading takes too long
        const timeout = setTimeout(() => {
            if (bsModal) {
                bsModal.hide();
                // Fallback: Manually remove modal classes if hide fails
                loadingModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
                showFeedback('Loading timed out. Please try again.', 'error');
            }
        }, LOAD_TIMEOUT);
        
        const response = await fetch('/load_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        
        clearTimeout(timeout); // Clear the timeout since loading succeeded
        
        if (data.status === 'success' || data.status === 'partial_success') {
            let message = 'Data loaded successfully! You can now start the quiz.';
            if (data.status === 'partial_success') {
                message = 'Some data loaded successfully. Check console for details.';
                console.log("Load data results:", data.results);
            }
            showFeedback(message, 'success');
            
            // Invalidate stats cache and reload stats
            statsCache = null;
            await loadStats();
            
            // Auto-select the first category
            const firstCategory = document.querySelector('.category-btn');
            if (firstCategory) {
                firstCategory.click();
            }
        } else {
            throw new Error('Data loading failed');
        }
    } catch (err) {
        console.error("Load data error:", err);
        showFeedback('Failed to load data. Please try again.', 'error');
    } finally {
        // Ensure the modal is hidden in all cases
        if (bsModal) {
            bsModal.hide();
            // Fallback: Manually remove modal classes if hide fails
            if (loadingModal.classList.contains('show')) {
                loadingModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) backdrop.remove();
            }
        }
    }
}

// Show feedback message
function showFeedback(message, type = 'success') {
    const feedbackArea = document.getElementById('feedback-area');
    feedbackArea.innerHTML = `
        <div class="feedback-message ${type}">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        </div>
    `;
    
    // Auto-clear feedback after 3 seconds
    setTimeout(clearFeedback, 3000);
}

// Clear feedback message
function clearFeedback() {
    const feedbackArea = document.getElementById('feedback-area');
    feedbackArea.innerHTML = '';
}

// Fisher-Yates shuffle algorithm
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
