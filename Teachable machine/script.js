
// =====================================
// MODEL CONFIGURATION
// =====================================

const MODEL_URL =
    "https://teachablemachine.withgoogle.com/models/HEIb99w7y/";

const CONFIDENCE_THRESHOLD = 0.80;

let model = null;
let webcam = null;

let isRunning = false;
let isLoading = false;

let animationId = null;
let isPredicting = false;


// =====================================
// HTML ELEMENTS
// =====================================

const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");

const webcamContainer = document.getElementById("webcam-container");
const cameraPlaceholder = document.getElementById("camera-placeholder");

const cameraStatus = document.getElementById("camera-status");
const cameraStatusText = document.getElementById("camera-status-text");

const recognizedSign = document.getElementById("recognized-sign");
const resultLabel = document.getElementById("result-label");
const statusMessage = document.getElementById("status");

const errorMessage = document.getElementById("error-message");


// =====================================
// INITIAL PAGE SETTINGS
// =====================================

document.getElementById("current-year").textContent =
    new Date().getFullYear();

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);


// =====================================
// DISPLAY CAMERA STATUS
// =====================================

function updateCameraStatus(state, message) {

    cameraStatus.classList.remove("active", "error");

    if (state === "active") {
        cameraStatus.classList.add("active");
    }

    if (state === "error") {
        cameraStatus.classList.add("error");
    }

    cameraStatusText.textContent = message;
}


// =====================================
// DISPLAY RECOGNITION RESULT
// =====================================

function showResult(label, message, state = "waiting") {

    recognizedSign.textContent = label;
    statusMessage.textContent = message;

    if (state === "recognized") {
        resultLabel.textContent = "SIGN RECOGNIZED";
    } else if (state === "error") {
        resultLabel.textContent = "SOMETHING WENT WRONG";
    } else if (state === "stopped") {
        resultLabel.textContent = "CAMERA STOPPED";
    } else {
        resultLabel.textContent = "WAITING FOR INPUT";
    }
}


// =====================================
// ERROR MESSAGE
// =====================================

function showError(message) {

    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

function clearError() {

    errorMessage.textContent = "";
    errorMessage.hidden = true;
}


// =====================================
// START CAMERA
// =====================================

async function startCamera() {

    if (isRunning || isLoading) {
        return;
    }

    isLoading = true;

    startButton.disabled = true;
    stopButton.disabled = true;

    startButton.textContent = "Starting...";

    clearError();

    showResult(
        "Loading...",
        "Preparing your sign language translator."
    );

    try {

        // Check browser support.
        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            throw new Error(
                "Your browser does not support camera access. " +
                "Please use a modern browser and open the page " +
                "through localhost or HTTPS."
            );
        }

        // Load the trained model only once.
        if (!model) {

            const modelURL = MODEL_URL + "model.json";
            const metadataURL = MODEL_URL + "metadata.json";

            model = await tmImage.load(
                modelURL,
                metadataURL
            );
        }

        // Create the webcam if it does not exist.
        if (!webcam) {

            webcam = new tmImage.Webcam(
                300,
                300,
                true
            );

            await webcam.setup();
        }

        // Start the webcam.
        await webcam.play();

        // Display the webcam.
        webcamContainer.replaceChildren(webcam.canvas);

        webcamContainer.classList.add("visible");

        cameraPlaceholder.hidden = true;

        // Update interface.
        isRunning = true;

        updateCameraStatus("active", "Camera active");

        showResult(
            "Show a sign",
            "Keep your hand visible while the camera is running."
        );

        startButton.textContent = "Camera Running";
        startButton.disabled = true;

        stopButton.disabled = false;

        // Start recognition.
        animationId = requestAnimationFrame(loop);

    } catch (error) {

        console.error("Camera startup error:", error);

        let message =
            "Unable to start the camera. Please try again.";

        if (error.name === "NotAllowedError") {

            message =
                "Camera access was denied. Allow camera permission " +
                "in your browser settings and try again.";

        } else if (error.name === "NotFoundError") {

            message =
                "No camera was found. Connect a webcam or check " +
                "your device's built-in camera.";

        } else if (error.name === "NotReadableError") {

            message =
                "The camera may already be in use by another app. " +
                "Close other camera apps and try again.";

        } else if (
            error.message &&
            error.message.includes("does not support camera access")
        ) {

            message = error.message;

        } else if (
            error.message &&
            error.message.toLowerCase().includes("fetch")
        ) {

            message =
                "Unable to load the recognition model. " +
                "Check your internet connection and model URL.";
        }

        updateCameraStatus("error", "Camera unavailable");

        showResult(
            "Camera unavailable",
            "Please check the message below.",
            "error"
        );

        showError(message);

        startButton.textContent = "Try Again";
        startButton.disabled = false;

        stopButton.disabled = true;

        // Release the webcam if startup failed.
        if (webcam) {

            try {
                webcam.stop();
            } catch (stopError) {
                console.warn("Unable to stop webcam:", stopError);
            }

            webcam = null;
        }

        webcamContainer.replaceChildren();
        webcamContainer.classList.remove("visible");

        cameraPlaceholder.hidden = false;

        isRunning = false;

    } finally {

        isLoading = false;

        if (!isRunning) {
            startButton.disabled = false;
        }
    }
}


// =====================================
// RECOGNITION LOOP
// =====================================

async function loop() {

    if (!isRunning || !webcam) {
        return;
    }

    try {

        webcam.update();

        // Avoid overlapping predictions.
        if (!isPredicting) {
            await predictSign();
        }

    } catch (error) {

        console.error("Recognition error:", error);

        showResult(
            "Recognition error",
            "Something went wrong while analyzing the camera."
        );

    }

    if (isRunning) {
        animationId = requestAnimationFrame(loop);
    }
}


// =====================================
// PREDICT THE SIGN
// =====================================

async function predictSign() {

    if (!model || !webcam || isPredicting) {
        return;
    }

    isPredicting = true;

    try {

        const predictions = await model.predict(webcam.canvas);

        if (!predictions || predictions.length === 0) {
            return;
        }

        // Find the class with the highest probability.
        let bestPrediction = predictions[0];

        for (let i = 1; i < predictions.length; i++) {

            if (
                predictions[i].probability >
                bestPrediction.probability
            ) {
                bestPrediction = predictions[i];
            }
        }

        // Display the recognized class only if it passes
        // the confidence threshold.
        if (
            bestPrediction.probability >= CONFIDENCE_THRESHOLD
        ) {

            showResult(
                bestPrediction.className,
                "The model has identified a possible sign.",
                "recognized"
            );

        } else {

            showResult(
                "Sign not recognized",
                "Try adjusting your hand position or lighting."
            );

        }

    } catch (error) {

        console.error("Prediction failed:", error);

        showResult(
            "Recognition error",
            "Please try showing your sign again.",
            "error"
        );

    } finally {

        isPredicting = false;
    }
}


// =====================================
// STOP CAMERA
// =====================================

function stopCamera() {

    if (animationId !== null) {

        cancelAnimationFrame(animationId);

        animationId = null;
    }

    isRunning = false;

    if (webcam) {

        try {
            webcam.stop();
        } catch (error) {
            console.warn("Error stopping camera:", error);
        }

        webcam = null;
    }

    // Clear the preview.
    webcamContainer.replaceChildren();

    webcamContainer.classList.remove("visible");

    cameraPlaceholder.hidden = false;

    // Reset controls.
    startButton.disabled = false;
    startButton.textContent = "Start Camera";

    stopButton.disabled = true;

    // Update status.
    updateCameraStatus("waiting", "Camera off");

    showResult(
        "—",
        "Start the camera when you are ready.",
        "stopped"
    );

    clearError();
}

