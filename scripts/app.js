// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

const DEBUG = false; // Change animation speed

/**
 * Main initialization function
 */
function initializeApp() {
    setupScreenNavigationAndListeners();
    renderMachines();
}

/**
 * Sets up screen navigation and event listeners
 */
function setupScreenNavigationAndListeners() {
    document.addEventListener('click', e => {
        const trigger = e.target.closest('[data-screen]');
        if (!trigger) return;

        const nextScreen = trigger.dataset.screen;
        
        if (nextScreen === 'experiment' && !validateParticipantInfo()) {
            return;
        }

        showScreen(nextScreen);
        
        // Start running demo
        if (nextScreen === 'experiment') {
            disableUserInteraction();
            if (DEBUG) {
                runDemo();
            } else {
                setTimeout(() => {
                    verbalNarration('introduction')
                }, 1000);
            }
        }
    });

    document.getElementById('whySubmit').addEventListener('click', function() {
        // Grab the user's typed text from the textarea
        childExplanation = document.getElementById('whyText').value;

        // Remove box & replace text
        document.getElementById('why-section').style.display = 'none';
        document.getElementById('whyText').value = '';

        if (childExplanation.trim() === "") {
            return false; // Exit if the input is empty
        }
      
        logExplanation(childExplanation)
      });

    document.getElementById("continue-button").addEventListener("click", function() {
        function resetContinueClick() {
            // Hide below elements
            document.getElementById('why-section').style.display = 'none';
            document.getElementById('whyText').value = '';
            document.getElementById("continue-button").style.display = "none";

            // Reset click time for phase start
            lastClickTime = Date.now();
        }

        if (phase === "demo") {
            resetContinueClick();
            prepareComprehension();
        } else if (phase === "comprehension") {
            resetContinueClick();

            // Make machines clickable again
            document.querySelector(".machines-container").classList.add("is-question-phase");
            document.querySelectorAll('.machine').forEach(machine => {
                machine.onclick = () => {
                    handleMachineClick(machine.getAttribute('data-machine'),
                    comprehensiveQuestionIndex);
                };
            });

            showNextOutcomeContainer();
        } else if (phase === "extrasmall") {
            resetContinueClick();
            if (document.querySelector(".remaining-stars").innerHTML === extraSmallQuestion) {
                startSmallExperiment();
            } else {
                startQuestionExperiment();
            }
        } else if (phase === "question") {
            resetContinueClick();

            // Clear hats collected and display next question
            itemsCollected.forEach(hat => {
                hat.parentNode.removeChild(hat);
            });
            itemsCollected = [];
            displayNextQuestion();
        } else if (phase == "lightness") {
            resetContinueClick();
            verbalNarration()

            // Clear lightbulbs collected
            itemsCollected.forEach(lightbulb => {
                lightbulb.parentNode.removeChild(lightbulb);
            });
            itemsCollected = [];

            // Exit if all lightbulb rounds are done
            if (lightbulbIndex == maxLightbulbRounds) {
                startVerbalQuestions();
                return;
            }
            
            startLightnessExperiment();
        } else if (phase === "verbalquestion") {
            resetContinueClick();

            if (questionIndex < questions.length) {
                // Make machines clickable again
                document.querySelector(".machines-container").classList.add("is-question-phase");
                document.querySelectorAll('.machine').forEach(machine => {
                    machine.onclick = () => {
                        handleMachineClick(machine.getAttribute('data-machine'));
                    };
                });

                verbalNarration()
                document.getElementById("instruction-text").innerText = questions[questionIndex];
            } else {
                saveCSV();
                showScreen("thank-you");
                return;
            }
        } 
    });

    document.getElementById("exit-button").addEventListener("click", function() {
        saveCSV();
        showScreen("thank-you");
    });
}

/**
 * Shows a screen by ID and hides all other screens.
 * If the screen ID is 'decline', shows a special decline message on the consent screen.
 * Otherwise, hides all screens and shows the requested screen if it exists.
 */
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.hidden = true;
    });

    // Special case for decline
    if (screenId === 'decline') {
        const consentScreen = document.getElementById('consent');
        consentScreen.innerHTML = `
            <h2>Thank you for your time.</h2>
            <p>You have declined to participate in the study.</p>
        `;
        consentScreen.hidden = false;
        return;
    }

    // Show requested screen
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.hidden = false;
    }
}

/**
 * Validates the participant information form.
 */
function validateParticipantInfo() {
    // Get participant info from form inputs & clean up values
    prolificId = document.querySelector('input[name="prolificId"]').value.trim();
    age = document.querySelector('input[name="age"]').value.trim();
    sex = document.querySelector('input[name="sex"]').value.trim().toUpperCase();

    // Check if any field is empty
    if (!prolificId || !age || !sex) {
        alert('Please fill out all fields.');
        return false;
    }

    // Validate age is a reasonable number
    if (isNaN(age) || age < 1 || age > 120) {
        alert('Please enter a valid age.');
        return false;
    }

    // Validate sex is either F or M
    if (sex !== 'F' && sex !== 'M') {
        alert('Please enter F or M for sex.');
        return false;
    }

    return true;
}

/**
 * Utility function to randomly shuffle elements in an array.
 */
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

/**
 * Maps numeric order values to slot size class names.
 */
function getSlotClass(order) {
    switch(order) {
        case 0:
            return 'extrasmall'
        case 1:
            return 'small';
        case 2:
            return 'medium';
        case 3:
            return 'large';
        default:
            return 'medium';
    }
}

/* Global variables for tracking machine configuration

* prolificId: Prolific ID of the participant
* age: Age of the participant
* sex: Sex of the participant

* MACHINES: Array of machine names that will be randomly ordered during experiment
* entropyFirstRound: Tracks which slots have received stars in the entropy machine's first round
* entropySlotOutputs: Tracks each slot's 1st 3 outcome stars (to ensure they are not the same)
* slotSizeMap: Maps each machine's slots to their corresponding size classes

* comprehensionQuestion: Question for comprehension phase
* extraSmallQuestion: Question for extrasmall phase
* smallExperimentQuestion: Question for small experiment phase
* questions: Array of questions for question phase
* lightbulbQuestions: Array of questions for lightness phase

* machineLayout: String recording the final randomized order of machines 
* colorLayout: String recording the final randomized order of colors
* slotLayout: String recording the final configuration of slot sizes

* remainingStars: Number of stars remaining to be dropped
* phase: String recording the current phase of the experiment

* outcomesContainers: Array of outcomes-containers

* comprehensiveQuestionIndex: Index of the current comprehensive question
* questionIndex: Index of the current question

* lightbulbIndex: Index of the current lightbulb question
* maxLightbulbRounds: Maximum number of lightbulb rounds

* extrasmallTrial: Number of current extrasmall trial
* questionTrial: Number of current question trial
* lightnessTrial: Number of current lightness trial
* explorationTrial: Number of current exploration trial

* itemsCollected: Array of items collected (to be cleared later)
* hatsCollected: Array of hats to clear at end of questions phase
* lightbulbsCollected: Array of lightbulbs to clear at end of lightness phase
* interactionLogs: Array of interaction logs
* reactionTimes: Array of reaction times
* lastClickTime: Time of the last click
* childExplanation: Reasoning, if given, on experiment interaction selection

*/
let prolificId = '';
let age = '';
let sex = '';

const MACHINES = ['Exploiter', 'Empowerment', 'Entropy'];
const entropyFirstRound = { Entropy: [true, true, true] };
const entropySlotOutputs = { 0: [], 1: [], 2: [] };
const slotSizeMap = {};

const demoInstructions = "You are an elf in a star factory. The star factory has three machines. Each machine has three slots that make stars bigger or smaller. You will now watch the stars go into the different slots. Notice what happens to the stars.";
const comprehensionQuestion = "Remember the stars that you made from the machines? Which machine made these stars?";
const extraSmallQuestion = "Now the elf boss gives you one more slot to make stars. The slot looks like this. Which machine would you like to put this slot in?";
const smallExperimentQuestion = "Now there is a new slot on the right end of each machine. The elf boss wants you to make an extra small star for his baby, smaller than any of the other ones you have seen. You have one chance. Which slot will you use?";
const questions = [
    "You are now an elf working in a hat factory. Before you start working, you are given 2 hats to try out. The machines change the size of the hats. You can put them in any of the slots in any of the machines.",
    "Now the elf boss wants you to make the biggest hats you can make. Where would you put these three hats?",
    "Now the elf boss wants you to make three medium sized hats. Where would you put these three hats?",
    "Now the elf boss wants you to make three small hats. Where would you put these three hats?",
    "Now the elf boss has a new job for you. You will work to make new kinds of things that he wants. Which machine do you want to keep?",
    "You are now given more things. You can play with one machine more. Which machine do you choose?"
];
const lightbulbQuestions = [
    "You are now an elf working in a lightbulb factory. Before you start working, you are given 2 lightbulbs to try out. The machines change the brightness of the lightbulbs. You can put them in any of the slots in any of the machines.",
    "Now the elf boss wants you to make a dim lightbulb a bright lightbulb (like circled). Where would you put this lightbulb to make it a bright lightbulb?",
    "Now the elf boss wants you to make a bright lightbulb a dim lightbulb (like circled). Where would you put this lightbulb to make it a dim lightbulb?"
]

let machineLayout = '';
let slotLayout = '';

let remainingStars = 27;
let phase = "demo"; // demo, comprehension, extrasmall, question, lightness, verbalquestion, exploration

let outcomesContainers = [];

let comprehensiveQuestionIndex = 0;
let questionIndex = 0;

let lightbulbIndex = 0;
let maxLightbulbRounds = 3;

let extrasmallTrial = 0;
let questionTrial = 0
let lightnessTrial = 0;
let explorationTrial = 0;

let itemsCollected = [];
let hatsCollected = [];
let lightbulbsCollected = [];
let interactionLogs = [];
let reactionTimes = [];
let lastClickTime = Date.now();
let childExplanation = '';

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Renders the machines with randomized colors, slot sizes, and positions.
 * Sets up drag and drop functionality for each slot and records the layout
 * of machines and slot sizes.
 */
let shuffledMachines;
let shuffledColors;
let randomSlotOrder;
function renderMachines() {
    const machineContainer = document.getElementById('machines-container');
    const existingOutcomes = {}; // If in extrasmall phase, save existing outcomes

    // Initial shuffling for first machine phase
    if (phase === "demo") {
        shuffledMachines = [...MACHINES].sort(() => Math.random() - 0.5);
        shuffledColors = ['blue-machine', 'green-machine', 'purple-machine'].sort(() => Math.random() - 0.5);

        const possibleSlotOrders = [[1, 3, 2], [3, 1, 2], [2, 1, 3], [2, 3, 1]];
        // randomSlotOrder = possibleSlotOrders[Math.floor(Math.random() * 4)];
        randomSlotOrder = [3,2,1];
    } else if (phase === "extrasmall") { // Save existing outcomes otherwise
        shuffledMachines.forEach(machine => {
            existingOutcomes[machine] = {
                0: document.getElementById(`outcome-slot-0-${machine}`)?.innerHTML,
                1: document.getElementById(`outcome-slot-1-${machine}`)?.innerHTML,
                2: document.getElementById(`outcome-slot-2-${machine}`)?.innerHTML
            };
        });
    }

    machineContainer.innerHTML = '';
    
    shuffledMachines.forEach((machine, index) => {
        const machineHTML = `
            <div class="machine-container" data-machine="${machine}">
                <div class="machine ${shuffledColors[index]}" data-machine="${machine}">
                    <div class="slots">
                        <div class="slot ${getSlotClass(randomSlotOrder[0])}" 
                             data-slot="0" 
                             data-size="${getSlotClass(randomSlotOrder[0])}"
                             ondrop="handleDrop(event, '${machine}', 0)"
                             ondragover="handleAllowDrop(event, ${randomSlotOrder[0]})">
                            <button></button>
                        </div>
                        <div class="slot ${getSlotClass(randomSlotOrder[1])}"
                             data-slot="1"
                             data-size="${getSlotClass(randomSlotOrder[1])}"
                             ondrop="handleDrop(event, '${machine}', 1)"
                             ondragover="handleAllowDrop(event, ${randomSlotOrder[1]})">
                            <button></button>
                        </div>
                        <div class="slot ${getSlotClass(randomSlotOrder[2])}"
                             data-slot="2"
                             data-size="${getSlotClass(randomSlotOrder[2])}"
                             ondrop="handleDrop(event, '${machine}', 2)"
                             ondragover="handleAllowDrop(event, ${randomSlotOrder[2]})">
                            <button></button>
                        </div>
                        ${phase === "extrasmall" ? `
                        <div class="slot extrasmall"
                             data-slot="3"
                             data-size="extrasmall" 
                             ondrop="handleDrop(event, '${machine}', 3)"
                             ondragover="handleAllowDrop(event, 0)">
                            <button></button>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="outcomes-container">
                    <div class="outcome" id="outcome-slot-0-${machine}">${phase === "extrasmall" ? existingOutcomes[machine][0] || '' : ''}</div>
                    <div class="outcome" id="outcome-slot-1-${machine}">${phase === "extrasmall" ? existingOutcomes[machine][1] || '' : ''}</div>
                    <div class="outcome" id="outcome-slot-2-${machine}">${phase === "extrasmall" ? existingOutcomes[machine][2] || '' : ''}</div>
                    ${phase === "extrasmall" ? `
                    <div class="outcome" id="outcome-slot-3-${machine}"></div>
                    ` : ''}
                </div>
            </div>
        `;
        machineContainer.insertAdjacentHTML('beforeend', machineHTML);
    });

    // Record machine layout
    machineLayout = shuffledMachines.join(', ');
    colorLayout = shuffledColors.map(color => capitalize(color.split('-')[0])).join(', ');
    slotLayout = randomSlotOrder.map(order => getSlotClass(order)[0].toUpperCase()).join('');

    // Set up slotSizeMap
    shuffledMachines.forEach(machine => {
        slotSizeMap[machine] = {
            0: getSlotClass(randomSlotOrder[0]),
            1: getSlotClass(randomSlotOrder[1]), 
            2: getSlotClass(randomSlotOrder[2]),
        };
        if (phase === "extrasmall") {
            slotSizeMap[machine][3] = getSlotClass(0);
        }
    });

    // Add dragleave event listener to all slots
    document.querySelectorAll('.slot').forEach(slot => {
        slot.addEventListener('dragleave', handleDragLeave);
    });
}

/**
 * Handles the dragover event when a star is dragged over a slot.
 * Adds visual feedback by enlarging the slot and allows the drop operation.
 */
function handleAllowDrop(event) {
    event.preventDefault();
    
    const slot = event.target.closest('.slot');
    if (slot) {
        slot.classList.add('hover-enlarge');
    }
}

/**
 * Handles the dragleave event when a star is dragged away from a slot.
 * Removes the visual hover effect from the slot.
 */
function handleDragLeave(event) {
    const slot = event.target.closest('.slot');
    if (slot) {
        slot.classList.remove('hover-enlarge');
    }
}

/**
 * Handles the drop event when a star is dragged onto a slot.
 * Creates a fade-out animation and triggers the star placement logic.
 */
function handleDrop(event, machine, slotIndex, demoSlot) {
    // Return if no stars remaining
    if (remainingStars <= 0) {
        return;
    }

    let slot;
    if (event != '') {
        event.preventDefault();
        slot = event.target.closest('.slot');
    } else {
        slot = demoSlot;
    }

    // Special case for lightness phase
    if (phase == "lightness") {
        adjustStarBrightness(machine, slotIndex);
        return;
    }

    // Get DOM elements
    const starContainer = document.querySelector('.draggable-star');
    const originalStar = starContainer?.querySelector('.star');

    if (!slot || !originalStar) {
        return;
    }

    // Remove hover effect
    slot.classList.remove('hover-enlarge');

    // Create and position temporary clone for fade-out animation
    const tempStar = originalStar.cloneNode(true);
    tempStar.classList.add('fade-out');

    // Position the temporary star at the slot center
    const slotRect = slot.getBoundingClientRect();
    tempStar.style.position = 'absolute';
    tempStar.style.left = `${slotRect.left + slotRect.width / 2 - tempStar.offsetWidth / 2 - 20}px`;
    tempStar.style.top = `${slotRect.top + slotRect.height / 2 - tempStar.offsetHeight / 2}px`;
    
    document.body.appendChild(tempStar);

    // Hide original star during animation
    starContainer.style.visibility = 'hidden';
    originalStar.style.visibility = 'hidden';

    // Handle fade-out animation completion
    tempStar.addEventListener('animationend', () => {
        tempStar.remove();
        
        // Show original star again if stars remain
        if (remainingStars > 0) {
            setTimeout(() => {
                originalStar.style.visibility = 'visible';
                starContainer.style.visibility = 'visible';
            }, 100);
        }
    });

    // Trigger star placement
    dropStars(event, machine, slotIndex);
}

/**
 * Narrates introduction and star outcome for demo phase.
 */
function verbalNarration(starSize = null) {
    let audioFile = '';
  
    if (phase === 'demo') {
      if (starSize === 'introduction') {
        audioFile = 'audio/demo-instructions.mp3';
      } else if (starSize === 'finish') {
        audioFile = 'audio/demo-finish.mp3';
      } else if (starSize === 'small') {
        audioFile = 'audio/demo-smaller.mp3';
      } else if (starSize === 'medium') {
        audioFile = 'audio/demo-same.mp3';
      } else if (starSize === 'large') {
        audioFile = 'audio/demo-bigger.mp3';
      }
    } else if (phase === 'comprehension') {
      audioFile = 'audio/comprehension.mp3';
    } else if (phase === 'extrasmall') {
      if (starSize === 'smallExperiment') {
        audioFile = 'audio/extrasmall-smallExperiment.mp3';
      } else {
        audioFile = 'audio/extrasmall.mp3';
      }
    } else if (phase === 'question') {
        audioFile = `audio/question-${questionIndex+1}.mp3`;
    } else if (phase === 'verbalquestion') {
        audioFile = `audio/verbalQuestion-${questionIndex+1}.mp3`; // questionIndex starts from 3
    } else if (phase === 'lightness') {
      audioFile = `audio/lightness-${lightbulbIndex+1}.mp3`;
    } else if (phase === 'exploration') {
      audioFile = 'audio/exploration.mp3';
    }
  
    playLocalAudio(audioFile)
      .then(() => {
        if (starSize === 'introduction') {
          runDemo();
        } 
      })
      .catch((error) => {
        console.error('Error during narration:', error);
      });
}

/**
 * Plays audio file decided from verbalNarration.
 */
function playLocalAudio(audioPath) {
    return new Promise((resolve, reject) => {
      const audioElement = document.getElementById('ttsAudio');
      if (!audioElement) {
        return reject(new Error(`Audio element with ID "ttsAudio" not found.`));
      }
  
      audioElement.src = audioPath;
  
      // When playback finishes
      audioElement.onended = () => {
        resolve();
      };
  
      // If playback fails
      audioElement.onerror = (error) => {
        reject(error);
      };
  
      // Start playing the audio
      audioElement.play();
    });
  }

/**
 * Returns a random star size from available options.
 */
function getRandomStarSize() {
    const sizes = ['small', 'medium', 'large'];
    return sizes[Math.floor(Math.random() * sizes.length)];
}

/**
 * Returns a random star size that doesn't match the given slot size.
 */
function getRandomSizeNotMatchingSlot(slotSize) {
    const sizes = ['small', 'medium', 'large'];
    sizes.splice(sizes.indexOf(slotSize), 1);
    return sizes[Math.floor(Math.random() * sizes.length)];
}

/**
 * Places a star in the outcome slot and handles related UI updates.
 */
function dropStars(event, machine, slotIndex) {
    if (event) {
        event.preventDefault();
    }

    // Update remaining stars count
    remainingStars--;
    const remainingStarsElement = document.getElementById("remainingStars");
    if (remainingStarsElement) {
        remainingStarsElement.innerText = remainingStars;
    } 

    // Determine star size based on machine type and conditions
    let size = '';
    switch (machine) {
        case 'Exploiter':
            size = 'medium';
            break;
        case 'Empowerment': 
            size = slotSizeMap[machine][slotIndex];
            break;
        case 'Entropy':
            // Handle special first round logic for Entropy
            size = entropyFirstRound.Entropy[slotIndex] 
                ? getRandomSizeNotMatchingSlot(slotSizeMap[machine][slotIndex])
                : getRandomStarSize();
            if (entropyFirstRound.Entropy[slotIndex]) {
                entropyFirstRound.Entropy[slotIndex] = false;
            }

            if (slotIndex != 3) { // Not for extrasmall enabled slot
                const slotHistory = entropySlotOutputs[slotIndex];
                if (slotHistory.length === 2) { // Ensure 3rd outcome star maintains inconsistency
                    while (size === slotHistory[0] && size === slotHistory[1]) {
                        size = getRandomStarSize();
                    }
                    slotHistory.push(size);
                }
            }
            break;
    }

    // Start the narration
    if (phase == 'demo' && !DEBUG)
        verbalNarration(size)

    // Create and add star to outcome slot
    const outcomeDiv = document.getElementById(`outcome-slot-${slotIndex}-${machine}`);
    const starElement = document.createElement('span');
    starElement.className = `star ${size}`;

    if (phase == "question") {
        starElement.innerHTML = '🎩';
        console.log(questionIndex)
        if (questionIndex != 1) {
            itemsCollected.push(starElement);
        } else {
            hatsCollected.push(starElement);
        }
    } else if (phase == "exploration") {
        starElement.innerHTML = '🍄';
    } else {
        starElement.innerHTML = '★';
    }

    // Add star with animation delay
    setTimeout(() => {
        outcomeDiv.appendChild(starElement);
    }, 700);
    
    // Log interaction
    if (phase != "demo") {
        reactionTimes.push(Date.now() - lastClickTime);
        lastClickTime = Date.now();
    } else if (phase == "demo") {
        reactionTimes.push(0);
    }
    logInteraction(machine, slotSizeMap[machine][slotIndex], size);

    // Handle end of stars
    if (remainingStars == 0 && phase != "demo") {
        document.getElementById('why-section').style.display = 'block';
        document.getElementById("continue-button").style.display = "block";
    }

}

/**
 * Prepares the UI for the comprehension phase by hiding specific elements
 * and starting or ending comprehension questions based on remaining stars.
 */
function prepareComprehension() {
    // Hide text and skip button
    const elementsToHide = ["drag-instruction", "continue-button", "playing-text", "finish-text", "star"];
    elementsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = "none";
        }
    });

    // Attach click handlers to machines
    document.querySelectorAll('.machine').forEach(machine => {
        machine.onclick = () => {
            handleMachineClick(machine.getAttribute('data-machine'),
            comprehensiveQuestionIndex);
        };
    });

    // Make machines clickable
    document.querySelector(".machines-container").classList.add("is-question-phase");

    if (remainingStars != 27)
        startComprehensionQuestions();
    else
        endComprehensionQuestions();    
}

/**
 * Initializes the comprehension phase by setting up the UI elements,
 * attaching click handlers to machines, and displaying the first
 * comprehension question.
 */
function startComprehensionQuestions() {
    phase = "comprehension";
    verbalNarration()
    document.getElementById('why-section').style.display = 'none';

    // Setup outcomes containers
    const topOutcomesContainer = document.getElementById("top-outcomes-container");
    topOutcomesContainer.innerHTML = "";

    // Collect containers
    outcomesContainers = Array.from(document.querySelectorAll(".outcomes-container"));

    // Show comprehension question
    document.querySelector(".remaining-stars").innerHTML = comprehensionQuestion;

    // Show first comprehension screen
    showNextOutcomeContainer();
}

/**
 * Displays the next outcome container for comprehension questions.
 * Clones and styles the container, adds spacing elements, and
 * proceeds to end comprehension if all questions are complete.
 */
function showNextOutcomeContainer() {
    // Find next comprehension question
    while (comprehensiveQuestionIndex < outcomesContainers.length) {
        document.getElementById("continue-button").style.display = "none"; // Hide continue button

        const currentContainer = outcomesContainers[comprehensiveQuestionIndex].cloneNode(true);
        const stars = currentContainer.querySelectorAll(".star");

        if (stars.length === 0) {
            comprehensiveQuestionIndex++;
            continue;
        }

        verbalNarration()

        // Display container with stars
        const topOutcomesContainer = document.getElementById("top-outcomes-container");
        topOutcomesContainer.innerHTML = "";

        // Add spacing and styling
        currentContainer.style.marginBottom = "0";
        
        // Create wrapper elements
        const spacer = document.createElement("div");
        spacer.style.height = "20px";
        
        const outcomeWrapper = document.createElement("div");
        outcomeWrapper.style.display = "flex";
        outcomeWrapper.style.justifyContent = "center";
        outcomeWrapper.style.width = "100%";
        outcomeWrapper.appendChild(currentContainer);

        // Add elements to container
        topOutcomesContainer.appendChild(spacer);
        topOutcomesContainer.appendChild(outcomeWrapper);

        // Show original container
        outcomesContainers[comprehensiveQuestionIndex].style.display = "flex";
        break;
    }

    // Proceed to end comprehension questions when finished
    if (comprehensiveQuestionIndex == outcomesContainers.length) {
        endComprehensionQuestions();
    }
}

/**
 * Handles machine click events during specific game phases.
 */
function handleMachineClick(machine, machineType) {
    // Log reaction time
    reactionTimes.push(Date.now() - lastClickTime);
    lastClickTime = Date.now();

    let correctness = "";
    let machinesLog = machineLayout.split(", ")

    // Only handle clicks during specific phases
    if (!["comprehension", "extrasmall", "verbalquestion"].includes(phase)) {
        return;
    }

    if (phase === "comprehension") {
        // Check machine correctness
        correctness = machine != machinesLog[machineType] ? "Incorrect" : "Correct";
        
        // Proceed to next question
        comprehensiveQuestionIndex++;

        document.getElementById("continue-button").style.display = "block";
    } else {
        // Show why section
        document.getElementById('why-section').style.display = 'block';
    }

    // Show the continue button
    document.getElementById("continue-button").style.display = "block";

    logMachineChoice(machine, correctness);  

    document.querySelector(".machines-container").classList.remove("is-question-phase");
    document.querySelectorAll('.machine').forEach(machine => {
        machine.onclick = null; // Removes the click handler
    });

    if (phase === "verbalquestion") {
        // Proceed to next question
        questionIndex++;
    }
}

/**
 * Transitions from comprehension phase to extrasmall phase.
 * Updates UI elements and displays the extrasmall question
 * with a slot preview.
 */
function endComprehensionQuestions() {
    phase = "extrasmall";
    verbalNarration();

    // Clear outcomes container
    document.getElementById("top-outcomes-container").innerHTML = "";

    // Show extrasmall question
    document.querySelector(".remaining-stars").innerHTML = extraSmallQuestion;

    // Show slot preview
    const dragInstruction = document.getElementById("drag-instruction");
    dragInstruction.style.display = "block";
    dragInstruction.innerHTML = `
        <div class="lightbulb-wrapper">
            <span class="slot extrasmallColored"></span>
        </div>`;
}

/**
 * Starts the small experiment phase of the game.
 * Sets up the UI for the small star experiment where the player needs to make
 * an extra small star. Updates the instruction text, shows a star size comparison,
 * configures the draggable star, and hides unnecessary UI elements.
 */
function startSmallExperiment() {
    verbalNarration('smallExperiment')

    // Set available stars for this phase
    remainingStars = 1;

    // Re-render machines with updated configuration
    renderMachines();

    // Update instruction text
    document.getElementById("instruction-text").innerText = smallExperimentQuestion;

    // Show star size comparison visualization
    const playingText = document.getElementById("playing-text");
    playingText.style.display = "block";
    playingText.innerHTML = `
        <span class="star medium">★</span>
        <span class="arrow">→</span>
        <span class="star extrasmall">★</span>
    `;

    // Configure draggable star
    const starElement = document.getElementById("star");
    starElement.style.display = "block";
    starElement.style.visibility = "visible";
    starElement.innerHTML = '<span class="star medium">★</span>';

    // Hide unnecessary UI elements
    const elementsToHide = [
        document.getElementById("drag-instruction"),
        document.getElementById("finish-text"),
    ];
    elementsToHide.forEach(element => element.style.display = "none");
}

/**
 * Starts the question experiment phase of the game.
 * Sets up the UI for the question phase where players drag hats into slots.
 * Configures draggable hats, updates visibility of UI elements, and initializes
 * the first question.
 */
function startQuestionExperiment() {
    phase = "question";
    document.getElementById('why-section').style.display === 'none';

    // Set up draggable hats
    document.getElementById("star").style.display = "block";
    document.getElementById("star").innerHTML = '<span class="star medium">🎩</span>';

    // Update UI
    document.querySelector('.draggable-star').style.visibility = 'visible';
    document.getElementById("continue-button").style.display = "none";
    document.getElementById("playing-text").style.display = "none";
    document.getElementById("drag-instruction").style.display = "block";

    displayNextQuestion();
}

/**
 * Displays the next question in the question experiment phase.
 * Shows a new question if there are questions remaining (less than 3 completed).
 * Updates instruction text, resets hat visibility and remaining hats count,
 * and hides unnecessary UI elements. Advances to verbal questions phase when
 * all questions are complete.
 */
function displayNextQuestion() {
    // Re-display hats and hide continue button on new question
    document.querySelector('.draggable-star .star').style.visibility = 'visible';
    document.getElementById("continue-button").style.display = "none";

    if (questionIndex < 4) {
        verbalNarration()
        if (questionIndex == 0) {
            remainingStars = 2;
        } else {
            remainingStars = 3;
        }

        const instructionTextElement = document.getElementById("instruction-text");
        if (instructionTextElement) {
            instructionTextElement.innerText = questions[questionIndex];
        }

        const dragInstructionElement = document.getElementById("drag-instruction");
        if (dragInstructionElement && questionIndex == 0) {
            dragInstructionElement.innerHTML = 'Drag a hat to a slot. Hats left: <span id="remainingStars">2</span>';
        } else if (dragInstructionElement) {
            dragInstructionElement.innerHTML = 'Drag a hat to a slot. Hats left: <span id="remainingStars">3</span>';
        }
        
        document.getElementById("finish-text").style.display = "none";

        questionIndex++;
    } else {
        startLightnessExperiment();
    }
}

/**
 * Starts the verbal questions phase of the experiment.
 * Updates phase, hides UI elements not needed for verbal questions,
 * and displays the current question.
 */
function startVerbalQuestions() {
    phase = "verbalquestion";
    verbalNarration()
    document.getElementById('why-section').style.display === 'none';

    lightbulbsCollected.forEach(hat => {
        hat.parentNode.removeChild(hat);
    });

    // Hide elements not needed for verbal questions
    const elementsToHide = [
        document.getElementById("continue-button"),
        document.getElementById("drag-instruction"), 
        document.getElementById("star")
    ];
    elementsToHide.forEach(element => {
        if (element) element.style.display = "none";
    });

    // Update UI for question phase
    document.querySelector(".machines-container").classList.add("is-question-phase");
    document.getElementById("instruction-text").innerText = questions[questionIndex];
    document.getElementById("playing-text").innerText = "Click a machine to answer.";

    // Re-attach click handlers to machines
    document.querySelectorAll('.machine').forEach(machine => {
        machine.onclick = () => {
            handleMachineClick(machine.getAttribute('data-machine'));
        };
    });
}

/**
 * Starts the lightness experiment phase.
 * Sets up the UI for the lightbulb experiment, including displaying the appropriate
 * lightbulb options and instructions based on the current round.
 * Updates phase, resets remaining stars, and increments lightbulb index.
 */
function startLightnessExperiment() {
    phase = "lightness";

    if (lightbulbIndex == 0) {
        hatsCollected.forEach(hat => {
            hat.parentNode.removeChild(hat);
        });
        document.getElementById("playing-text").style.display = "none";
        remainingStars = 2;
    } else {
        remainingStars = 1;
        document.getElementById("playing-text").style.display = "block"
        document.getElementById("playing-text").innerHTML = `
                    <div class="lightbulb-wrapper">
                        ${lightbulbIndex === 2 ? '<span class="highlight-circle"><span class="lightbulb1"></span></span>' : '<span class="lightbulb1"></span>'}
                        <div class="lightbulb-label">a dim lightbulb</div>
                    </div>
                    <div class="lightbulb-wrapper">
                        <span class="lightbulb2"></span>
                        <div class="lightbulb-label">a sort of dim lightbulb</div>
                    </div>
                    <div class="lightbulb-wrapper">
                        <span class="lightbulb3"></span>
                        <div class="lightbulb-label">a sort of bright lightbulb</div>
                    </div>
                    <div class="lightbulb-wrapper">
                        ${lightbulbIndex === 1 ? '<span class="highlight-circle"><span class="lightbulb4"></span></span>' : '<span class="lightbulb4"></span>'}
                        <div class="lightbulb-label">a bright lightbulb</div>
                    </div>
                `;
    }
    verbalNarration()
    document.getElementById('why-section').style.display === 'none';

    // Update UI
    document.getElementById("continue-button").style.display = "none";
    document.querySelector(".machines-container").classList.remove("is-question-phase");
    document.querySelector('.draggable-star').style.visibility = 'visible';
    document.getElementById("drag-instruction").innerHTML = 'Drag the lightbulb to a slot.';

    // Set object to be lightbulb
    document.getElementById("star").style.display = "block";

    if (lightbulbIndex == 0) {
        document.getElementById("star").innerHTML = '<span class="lightbulb3"></span>';
    } else if (lightbulbIndex == 1) {
        document.getElementById("star").innerHTML = '<span class="lightbulb1"></span>'; 
    } else if (lightbulbIndex == 2) {
        document.getElementById("star").innerHTML = '<span class="lightbulb4"></span>';
    }

    // Update instruction for the round
    document.getElementById("instruction-text").innerText = `Round ${lightbulbIndex+1}/${maxLightbulbRounds}: ${lightbulbQuestions[lightbulbIndex]}`;

    lightbulbIndex++;
}

/**
 * Adjusts the brightness of a lightbulb based on the machine and slot it was dropped in.
 * Creates and animates a new lightbulb with the appropriate brightness level in the outcome slot.
 * Updates UI elements and collection tracking.
 */
function adjustStarBrightness(machine, slotIndex) {
    const outcomeDiv = document.getElementById(`outcome-slot-${slotIndex}-${machine}`);

    // Log reaction time
    reactionTimes.push(Date.now() - lastClickTime);
    lastClickTime = Date.now();

    // Determine the new brightness level based on machine logic
    let newBrightness = 0;
    switch (machine) {
        case 'Exploiter':
            newBrightness = 3;
            break;
        case 'Empowerment':
            switch (slotSizeMap[machine][slotIndex]) {
                case 'extrasmall': newBrightness = 1; break;
                case 'small': newBrightness = 2; break;
                case 'medium': newBrightness = 3; break;
                case 'large': newBrightness = 4; break;
            }
            break;
        case 'Entropy':
            newBrightness = Math.floor(Math.random() * 4)+1;
            break;
    }

    // Update the star in the outcome slot
    const lightbulb = document.createElement('span');
    lightbulb.className = `lightbulb${newBrightness}`;

    console.log(lightbulbIndex)
    if (lightbulbIndex != 1) {
        itemsCollected.push(lightbulb);    
    } else {
        lightbulbsCollected.push(lightbulb);
    }
    
    setTimeout(() => {
        outcomeDiv.appendChild(lightbulb);
            }, 700);

    logInteraction(machine, slotSizeMap[machine][slotIndex], newBrightness);

    remainingStars -= 1;

    if (remainingStars === 0) {
        // Hide the draggable star and show the continue button
        document.getElementById("star").style.display = "none";
        document.getElementById('why-section').style.display = 'block';
        document.getElementById("continue-button").style.display = "block";
    }
}

/**
 * Logs details about each interaction with the machines during the experiment.
 * Records participant info, trial details, machine choices, sizes, and timing data.
 * Formats size values appropriately based on the current experimental phase.
 */
function logInteraction(machine, slotSize, starSize) {
    let trialNumber;

    switch (phase) {
        case "extrasmall":
            trialNumber = ++extrasmallTrial;
            break;
        case "question":
            trialNumber = ++questionTrial;
            break;
        case "lightness":
            trialNumber = ++lightnessTrial;
            break;
        case "exploration":
            trialNumber = ++explorationTrial;
            break;
    }

    let formattedStarSize;
    let formattedSlotSize;

    if (phase === "lightness") {
        formattedStarSize = starSize.toString();  // Convert number to string
        formattedSlotSize = slotSize === 'extrasmall' ? 'E' : slotSize[0].toUpperCase();
    } else {
        formattedSlotSize = slotSize === 'extrasmall' ? 'E' : slotSize[0].toUpperCase();
        formattedStarSize = starSize === 'extrasmall' ? 'E' : starSize[0].toUpperCase();
    }

    interactionLogs.push({
        prolificId: prolificId,
        age: age,
        sex: sex,
        machineOrder: machineLayout,
        slotLayout: slotLayout,
        colorOrder: colorLayout,
        phase: phase.charAt(0).toUpperCase() + phase.slice(1),
        trial: trialNumber,
        machine: machine,
        slotSize: formattedSlotSize, 
        starSize: formattedStarSize, 
        reactionTime: reactionTimes[reactionTimes.length - 1],
        correctMachine: '',
        explanation: ''
    });
}

/**
 * Logs machine choice interactions during comprehension, extrasmall and question phases.
 * Records participant info, current question, machine choice, correctness and timing data.
 * Formats the trial field with the current question text and handles correctness validation.
 */
function logMachineChoice(machine, correctness) {
    let currentQuestion;
    
    if (phase == "comprehension") {
        currentQuestion = comprehensionQuestion;
    } else if (phase === "extrasmall") {
        currentQuestion = extraSmallQuestion;
        correctness = '';
    } else {
        currentQuestion = questionIndex < questions.length ? questions[questionIndex] : "No more questions";
        correctness = '';
    }

    interactionLogs.push({
        prolificId: prolificId,
        age: age,
        sex: sex,
        machineOrder: machineLayout,
        slotLayout: slotLayout,
        colorOrder: colorLayout,
        phase: phase.charAt(0).toUpperCase() + phase.slice(1),
        trial: currentQuestion,
        machine: machine,
        slotSize: '',
        starSize: '',
        reactionTime: reactionTimes[reactionTimes.length - 1],
        correctMachine: correctness,
        explanation: ''
    });
}

/**
 * Log child reasoning, if provided, for the experiment phase.
 */
function logExplanation() {
    interactionLogs.push({
        prolificId: prolificId,
        age: age,
        sex: sex,
        machineOrder: machineLayout,
        slotLayout: slotLayout,
        colorOrder: colorLayout,
        phase: phase.charAt(0).toUpperCase() + phase.slice(1),
        trial: '',
        machine: '',
        slotSize: '',
        starSize: '',
        reactionTime: '',
        correctMachine: '',
        explanation: childExplanation
    });
}

/**
 * Sets the absolute position of an HTML element using CSS left and top properties.
 */
function setPosition(el, x, y) {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

/**
 * Animates a cursor moving along a straight path between two points.
 */
function animateCursorPath(fakeCursor, fromX, fromY, toX, toY, steps) {
    return new Promise((resolve) => {
        let stepCount = 0;
        const stepX = (toX - fromX) / steps;
        const stepY = (toY - fromY) / steps;

        function step() {
            stepCount++;
            // Update the cursor's position
            const cursorX = fromX + stepX * stepCount;
            const cursorY = fromY + stepY * stepCount;

            setPosition(fakeCursor, cursorX, cursorY);

            if (stepCount < steps) {
                requestAnimationFrame(step);
            } else {
                resolve(); // Animation is done
            }
        }

        // Kick off the animation
        requestAnimationFrame(step);
    });
}

/**
 * Creates a promise that resolves after a specified delay.
 */
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Creates an invisible overlay to block user interaction with the page.
 */
function disableUserInteraction() {
    const overlay = document.createElement('div');
    overlay.id = 'interaction-blocker';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = 999999;
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    overlay.style.pointerEvents = 'auto';
    document.body.appendChild(overlay);
}

/**
 * Removes the interaction blocking overlay to re-enable user interaction.
 */
function enableUserInteraction() {
    const overlay = document.getElementById('interaction-blocker');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Runs an automated demo showing cursor movements between a star and machine slots.
 * The demo systematically moves through each machine and its slots, performing 3 star drops per slot.
 * For each drop, it animates cursor movement, enlarges the slot on hover, drops a star, and returns to start.
 */
function runDemo() {
    const fakeCursor = document.getElementById('fake-cursor');
    fakeCursor.innerHTML = '<span class="star medium">★</span>';
    fakeCursor.style.visibility = 'visible';

    const starRect = document.getElementById('star').getBoundingClientRect();
    const cursorRect = fakeCursor.getBoundingClientRect();
    const starX = starRect.left + (starRect.width - cursorRect.width) / 2;
    const starY = starRect.top + (starRect.height - cursorRect.height) / 2;

    // Define wait times
    const movementSteps = DEBUG ? 1 : 75;
    const waitOverSlot = DEBUG ? 0 : 1000;
    const waitAfterDrop = DEBUG ? 0 : 1000;
    const waitBetween = DEBUG ? 0 : 750;

    let slotRect;
    let slotX;
    let slotY;

    // Get machine and slot order
    const machines = document.getElementById('machines-container').querySelectorAll('.machine');
    let machineIndex = 0;

    /**
     * Processes each machine sequentially, calling processNextSlot for each machine's slots.
     */
    const processNextMachine = () => {
        if (machineIndex >= machines.length) {
            verbalNarration('finish')
            fakeCursor.style.display = 'none';
            enableUserInteraction();
            document.getElementById('continue-button').style.display = 'block';
            document.getElementById('exit-button').style.display = 'block';
            return;
        }

        const machine = machines[machineIndex];
        const slots = machine.querySelectorAll('.slot');
        let slotIndex = 0;

        /**
         * Processes each slot in the current machine, performing 3 star drops per slot.
         * For each drop: moves cursor to slot, enlarges slot, drops star, returns cursor to start.
         */
        const processNextSlot = async () => {
            if (slotIndex >= slots.length) {
                machineIndex++;
                processNextMachine();
                return;
            }

            // Get slot position
            const slot = slots[slotIndex];
            slotRect = slot.getBoundingClientRect();
            let curCursorRect = fakeCursor.getBoundingClientRect();
            slotX = slotRect.left + (slotRect.width - curCursorRect.width) / 2;
            slotY = slotRect.top + (slotRect.height - curCursorRect.height) / 2;

            for (let i = 0; i < 3; i++) {
                // Hide the draggable star
                document.getElementById('star').querySelector('.star.medium').style.visibility = 'hidden';

                // Move fake cursor from star -> slot
                await animateCursorPath(fakeCursor, starX, starY, slotX, slotY, movementSteps);

                // Hover over the slot briefly (enlarge it)
                slot.classList.add('hover-enlarge');
                await wait(waitOverSlot);

                // Drop a star
                slot.classList.remove('hover-enlarge');
                handleDrop('', machine.getAttribute('data-machine'), slot.getAttribute('data-slot'), slot);

                // Switch style to cursor
                fakeCursor.innerHTML = ''; // Remove any star text
                fakeCursor.classList.remove('fake-cursor-star');
                fakeCursor.classList.add('fake-cursor-pointer');
    
                await wait(waitAfterDrop);

                // Move fake cursor back from slot -> star
                await animateCursorPath(fakeCursor, slotX, slotY, starX, starY, movementSteps);
                await wait(waitBetween);

                // Switch style to star
                fakeCursor.innerHTML = '<span class="star medium">★</span>';
                fakeCursor.classList.remove('fake-cursor-pointer');
                fakeCursor.classList.add('fake-cursor-star');
                
            }

            slotIndex++;
            processNextSlot();
        };

        processNextSlot();
    };

    processNextMachine();
}

/**
 * Starts the exploration experiment phase where users can freely interact with machines.
 * Updates UI elements to show mushroom icons instead of stars and sets appropriate text.
 * Clears all previous outcomes and enables unlimited interactions.
 */
function startExplorationExperiment() {
    phase = "exploration";
    remainingStars = 2;
    verbalNarration()
    document.getElementById("continue-button").style.display = 'block';

    // Update UI
    document.getElementById("star").style.display = "block";
    document.getElementById('exit-button').style.display = 'none';

    // Clear outcome containers
    MACHINES.forEach(machine => {
        const outcomeContainer = document.querySelector(`[data-machine="${machine}"] .outcomes-container`);
        outcomeContainer.innerHTML = `
            <div class="outcome" id="outcome-slot-0-${machine}"></div>
            <div class="outcome" id="outcome-slot-1-${machine}"></div>
            <div class="outcome" id="outcome-slot-2-${machine}"></div>
            <div class="outcome" id="outcome-slot-3-${machine}"></div>
        `;
    });

    document.getElementById("star").innerHTML = '<span class="star medium">🍄</span>';
    document.getElementById("instruction-text").innerText = "You are now given 2 mushrooms. You can put them in any of the slots from any of the machines.";
    document.getElementById("playing-text").innerText = "When you are done, you can hit the 'Finish Playing' button.";
    document.getElementById("continue-button").innerText = "Finish Playing";
}   

function endExploration() {
    // Remove mushroom from further drop interaction
    remainingStars = 0;
    document.getElementById("star").style.display = "none";
    document.getElementById("instruction-text").style.display = "none";
    document.getElementById("playing-text").style.display = "none";

    document.getElementById('why-section').style.display = 'block';
    document.getElementById('whyText').placeholder = 'Optionally: Can you describe how you played with the machines? Did you learn anything new?';

    document.getElementById("continue-button").innerText = "Submit Experiment";
}

/**
 * Saves the experiment data to a Google Sheets spreadsheet using a Cloud Function.
 * Constructs the CSV content from the interaction logs and sends it to the Cloud Function.
 * Handles the response from the Cloud Function and displays success or error messages.
 */
function saveCSV() {
    const headers = [
        "Prolific ID", "Age", "Sex", "Machine Order (L->R)", 
        "Slot Layout Order (L->R)", "Color Order (L->R)", "Phase",
        "Trial", "Machine", "Slot Size", "Star Type", 
        "Reaction Time (ms)", "Correct Machine", "Explanation"
    ];

    // Preprocess interaction logs to merge explanations
    const processedLogs = interactionLogs.reduce((mergedLogs, currentLog, index) => {
        if (currentLog.explanation && currentLog.explanation.trim() !== "") {
            // Merge explanation with the previous log
            const previousLog = mergedLogs[mergedLogs.length - 1];
            if (previousLog) {
                previousLog.explanation = currentLog.explanation;
            }
        } else {
            // Add the log as-is if it doesn't have an explanation
            mergedLogs.push(currentLog);
        }
        return mergedLogs;
    }, []);

    const rows = processedLogs.length ? 
        processedLogs.map(log => [
            log.prolificId, log.age, log.sex, log.machineOrder,
            log.slotLayout, log.colorOrder, log.phase, log.trial,
            log.machine, log.slotSize, log.starSize, 
            log.reactionTime, log.correctMachine, log.explanation
        ]) :
        [[prolificId, age, sex, ...Array(10).fill("")]];

    const csvContent = [headers, ...rows];

    fetch('https://us-central1-goog24-02.cloudfunctions.net/saveToNewSheet', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            participantID: prolificId,
            data: csvContent
        })
    })
    .then(response => !response.ok ? response.text().then(text => { throw new Error(text) }) : response.json())
    .then(() => alert("Data saved successfully!"))
    .catch(error => {
        console.error('Error saving data:', error.message);
        alert("Error saving data: " + error.message);
    });
}