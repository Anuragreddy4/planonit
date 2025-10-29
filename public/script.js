// API base URL - automatically adapts to the environment
const API_BASE_URL = window.location.origin;

// DOM Elements
const syllabusInput = document.getElementById('syllabusInput');
const generateBtn = document.getElementById('generateBtn');
const studyPlanResult = document.getElementById('studyPlanResult');
const studyPlanContent = document.getElementById('studyPlanContent');

const pdfInput = document.getElementById('pdfInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const pdfAnalysisResult = document.getElementById('pdfAnalysisResult');
const pdfAnalysisContent = document.getElementById('pdfAnalysisContent');
const fileNameDisplay = document.getElementById('fileName');

// Event Listeners
generateBtn.addEventListener('click', generateStudyPlan);
analyzeBtn.addEventListener('click', analyzePDF);
pdfInput.addEventListener('change', handleFileSelection);

// Function to show/hide spinner
function toggleSpinner(button, show) {
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    
    if (show) {
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';
        button.disabled = true;
    } else {
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        button.disabled = false;
    }
}

// Function to display results
function displayResult(resultBox, contentElement, message, isError = false) {
    resultBox.style.display = 'block';
    contentElement.innerHTML = message;
    
    if (isError) {
        resultBox.classList.add('error');
    } else {
        resultBox.classList.remove('error');
    }
    
    // Scroll to result
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Generate Study Plan
async function generateStudyPlan() {
    const syllabus = syllabusInput.value.trim();
    
    if (!syllabus) {
        alert('Please enter your syllabus before generating a study plan.');
        return;
    }
    
    toggleSpinner(generateBtn, true);
    studyPlanResult.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/generate-plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ syllabus })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate study plan');
        }
        
        displayResult(studyPlanResult, studyPlanContent, data.studyPlan);
    } catch (error) {
        console.error('Error:', error);
        displayResult(
            studyPlanResult, 
            studyPlanContent, 
            `Error: ${error.message}\n\nPlease make sure:\n1. The server is running\n2. Your OpenAI API key is configured in the .env file\n3. You have internet connectivity`,
            true
        );
    } finally {
        toggleSpinner(generateBtn, false);
    }
}

// Handle file selection
function handleFileSelection(event) {
    const file = event.target.files[0];
    if (file) {
        fileNameDisplay.textContent = `Selected: ${file.name}`;
    } else {
        fileNameDisplay.textContent = '';
    }
}

// Analyze PDF
async function analyzePDF() {
    const file = pdfInput.files[0];
    
    if (!file) {
        alert('Please select a PDF file to analyze.');
        return;
    }
    
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }
    
    toggleSpinner(analyzeBtn, true);
    pdfAnalysisResult.style.display = 'none';
    
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/analyze-pdf`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze PDF');
        }
        
        const resultMessage = `${data.analysis}\n\n---\n\nExtracted Text Preview:\n${data.extractedText}`;
        displayResult(pdfAnalysisResult, pdfAnalysisContent, resultMessage);
    } catch (error) {
        console.error('Error:', error);
        displayResult(
            pdfAnalysisResult, 
            pdfAnalysisContent, 
            `Error: ${error.message}\n\nPlease make sure:\n1. The server is running\n2. Your OpenAI API key is configured in the .env file\n3. The PDF file is valid and contains text (not just images)\n4. You have internet connectivity`,
            true
        );
    } finally {
        toggleSpinner(analyzeBtn, false);
    }
}

// Check server health on page load
window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        console.log('Server status:', data);
    } catch (error) {
        console.warn('Could not connect to server. Make sure the backend is running.');
    }
});
