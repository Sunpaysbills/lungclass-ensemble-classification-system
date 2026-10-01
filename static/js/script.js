// ============================================================
// NAVIGATION
// ============================================================

const navButtons = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".page-section");

navButtons.forEach((button) => {

    button.addEventListener("click", () => {

        const target = button.dataset.page;

        navButtons.forEach((item) => {
            item.classList.remove("active");
        });

        sections.forEach((section) => {
            section.classList.remove("active");
        });

        button.classList.add("active");

        document
            .getElementById(target)
            .classList.add("active");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });

});


// ============================================================
// FORM
// ============================================================

const form = document.getElementById("prediction-form");

const predictButton =
    document.getElementById("predict-button");

const clearButton =
    document.getElementById("clear-button");

const resultSection =
    document.getElementById("prediction-result");

const processingBox =
    document.getElementById("predictionProcessing");

const processingStatus =
    document.getElementById("processingStatus");

const processingSteps =
    document.querySelectorAll(".processing-step");

const formInputs =
    form.querySelectorAll("input");

formInputs.forEach((input) => {

    input.addEventListener("input", () => {

        resultSection.classList.add("hidden");

    });

});


// ============================================================
// PREDICTION
// ============================================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    processingBox.classList.add("processing-visible");
    resultSection.style.display = "none";
    resultSection.classList.add("hidden");

    const processingMessages = [
        "Validating patient measurements...",
        "Applying preprocessing pipeline...",
        "Running ensemble base learners...",
        "Generating stacked classification..."
    ];

    let processingIndex = 0;

    processingStatus.textContent = processingMessages[0];

    processingSteps.forEach((step) => {
        step.classList.remove("active");
    });

    if (processingSteps[0]) {
        processingSteps[0].classList.add("active");
    }

    const processingInterval = setInterval(() => {

        processingIndex++;

        if (processingIndex >= processingMessages.length) {
            processingIndex = processingMessages.length - 1;
            return;
        }

        processingStatus.textContent =
            processingMessages[processingIndex];

        processingSteps.forEach((step) => {
            step.classList.remove("active");
        });

        if (processingSteps[processingIndex]) {
            processingSteps[processingIndex].classList.add("active");
        }

    }, 450);

    const formData = new FormData(form);

    const patientData = {};

    for (const [key, value] of formData.entries()) {
        patientData[key] = Number(value);
    }


    predictButton.disabled = true;
    predictButton.textContent = "Classifying...";


    try {

        const response = await fetch("/predict", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(patientData)

        });


        const result = await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.error ||
                "Prediction could not be completed."
            );

        }


        displayResult(result);

        clearInterval(processingInterval);

        processingStatus.textContent = "Classification complete";

        processingSteps.forEach((step) => {
            step.classList.add("active");
        });

        setTimeout(() => {

            processingBox.classList.remove("processing-visible");

            resultSection.style.display = "block";
            resultSection.classList.remove("hidden", "result-animated");

            void resultSection.offsetWidth;

            resultSection.classList.add("result-animated");

            resultSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }, 350);

    } catch (error) {

        clearInterval(processingInterval);
        processingBox.classList.remove("processing-visible");
        resultSection.style.display = "";
        resultSection.classList.add("hidden");

        alert(error.message);

    } finally {

        clearInterval(processingInterval);

        predictButton.disabled = false;

        predictButton.textContent =
            "Classify Patient";

    }

});

function animateProbability(element, finalValue) {

    if (!element) return;

    const duration = 900;
    const startTime = performance.now();

    function update(currentTime) {

        const elapsed = currentTime - startTime;

        const progress = Math.min(
            elapsed / duration,
            1
        );

        const easedProgress =
            1 - Math.pow(1 - progress, 3);

        const currentValue =
            finalValue * easedProgress;

        element.textContent =
            currentValue.toFixed(2) + "%";

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent =
                finalValue.toFixed(2) + "%";
        }
    }

    requestAnimationFrame(update);
}


// ============================================================
// DISPLAY RESULT
// ============================================================

function displayResult(result) {

    const classification =
        result.classification;

    const probability =
        result.ensemble_probability;

    const prediction =
        result.prediction;

    const probabilityPercent =
        probability * 100;

    document.getElementById(
        "result-classification"
    ).textContent = classification;

    document.getElementById(
        "result-badge"
    ).textContent = classification;

    const probabilityText =
        document.getElementById("ensemble-probability");

    animateProbability(
        probabilityText,
        probabilityPercent
    );

    const probabilityBar =
        document.getElementById("ensemble-bar");

    probabilityBar.style.width = "0%";

    setTimeout(() => {

        probabilityBar.style.transition =
            "width 1s cubic-bezier(0.22, 1, 0.36, 1)";

        probabilityBar.style.width =
            `${probabilityPercent}%`;

    }, 100);

    document.getElementById(
        "info-classification"
    ).textContent = classification;

    document.getElementById(
        "info-model-output"
    ).textContent = prediction === 1
        ? "Class 1"
        : "Class 0";

    const resultCard =
        document.querySelector(".final-result-card");

    const description =
        document.getElementById("result-description");

    resultCard.classList.remove(
        "result-obstructive",
        "result-non-obstructive"
    );

    if (prediction === 1) {

        resultCard.classList.add(
            "result-obstructive"
        );

        description.textContent =
            "The entered spirometry measurements were classified " +
            "by the stacked ensemble as obstructive.";

    } else {

        resultCard.classList.add(
            "result-non-obstructive"
        );

        description.textContent =
            "The entered spirometry measurements were classified " +
            "by the stacked ensemble as non-obstructive.";

    }

    const baseProbabilities = Object.values(
        result.base_probabilities
    );

    const positiveVotes = baseProbabilities.filter(
        probability => probability >= 0.50
    ).length;

    const negativeVotes =
        baseProbabilities.length - positiveVotes;

    let agreementDescription;

    if (prediction === 1) {
        agreementDescription =
            `${positiveVotes} of 4 base learners classified ` +
            `the record as obstructive.`;

    } else {
        agreementDescription =
            `${negativeVotes} of 4 base learners classified ` +
            `the record as non-obstructive.`;

    }

    document.getElementById(
        "agreement-description"
    ).textContent = agreementDescription;


    const badge =
        document.getElementById("result-badge");

    badge.classList.remove(
        "obstructive",
        "non-obstructive"
    );


    if (prediction === 1) {

        badge.classList.add("obstructive");

    } else {

        badge.classList.add("non-obstructive");

    }


}


// ============================================================
// CLEAR FORM
// ============================================================

clearButton.addEventListener("click", () => {

    form.reset();

    resultSection.classList.add("hidden");

});


// ============================================================
// PERFORMANCE CHART VIEWERS
// ============================================================

function animateChartChange(imageElement) {

    if (!imageElement) return;

    imageElement.classList.remove("chart-switch-animation");

    void imageElement.offsetWidth;

    imageElement.classList.add("chart-switch-animation");
}

function setupChartViewer(
    buttonSelector,
    imageId,
    titleId
) {

    const buttons =
        document.querySelectorAll(buttonSelector);

    const image =
        document.getElementById(imageId);

    const title =
        document.getElementById(titleId);

    buttons.forEach((button) => {

        button.addEventListener("click", () => {

            buttons.forEach((item) => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            const imageName =
                button.dataset.image;

            const chartTitle =
                button.dataset.title;

            image.classList.remove("image-loaded");

            image.src =
                `/static/images/${imageName}`;

            animateChartChange(image);

            image.alt =
                chartTitle;

            title.textContent =
                chartTitle;

        });

    });

}

setupChartViewer(
    ".confusion-button",
    "confusion-image",
    "confusion-title"
);

setupChartViewer(
    ".comparison-button",
    "comparison-image",
    "comparison-title"
);

/* =========================================================
   LUNGCLASS STARTUP ANIMATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const loader = document.getElementById("startupLoader");
    const progressBar = document.getElementById("loaderProgressBar");
    const percentText = document.getElementById("loaderPercent");
    const statusText = document.getElementById("loaderStatus");
    const modelItems = document.querySelectorAll(".loader-models span");

    if (!loader) return;

    let progress = 0;

    const statusMessages = [
        "Initializing Classification System...",
        "Loading Ensemble Models...",
        "Preparing Spirometry Analysis...",
        "System Ready"
    ];

    const progressInterval = setInterval(() => {

        progress += 2;

        if (progress > 100) {
            progress = 100;
        }

        progressBar.style.width = `${progress}%`;
        percentText.textContent = `${progress}%`;

        if (progress >= 15 && modelItems[0]) {
            modelItems[0].classList.add("model-active");
        }

        if (progress >= 35 && modelItems[1]) {
            modelItems[1].classList.add("model-active");
        }

        if (progress >= 55 && modelItems[2]) {
            modelItems[2].classList.add("model-active");
        }

        if (progress >= 75 && modelItems[3]) {
            modelItems[3].classList.add("model-active");
        }

        if (progress < 30) {
            statusText.textContent = statusMessages[0];
        } else if (progress < 60) {
            statusText.textContent = statusMessages[1];
        } else if (progress < 90) {
            statusText.textContent = statusMessages[2];
        } else {
            statusText.textContent = statusMessages[3];
        }

        if (progress >= 100) {

            clearInterval(progressInterval);

            setTimeout(() => {
                loader.classList.add("loader-hidden");

                const firstSection =
                    document.querySelector(".page-section.active") ||
                    document.querySelector(".page-section");

                animatePageSection(firstSection);

                setTimeout(() => {
                    loader.style.display = "none";
                    observeAnimatedCounters();
                }, 650);

            }, 450);
        }

    }, 35);

});

/* =========================================================
   COLLAPSIBLE SIDEBAR
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const sidebarToggle =
        document.getElementById("sidebarToggle");

    if (!sidebarToggle) return;

    const desktopLayout =
        window.matchMedia("(min-width: 761px)");

    let savedCollapsedState = false;

    try {
        savedCollapsedState =
            localStorage.getItem("lungclassSidebarCollapsed") === "true";
    } catch {
        savedCollapsedState = false;
    }

    function updateSidebarState(collapsed) {

        const isCollapsed = collapsed && desktopLayout.matches;

        document.body.classList.toggle(
            "sidebar-collapsed",
            isCollapsed
        );

        sidebarToggle.setAttribute(
            "aria-expanded",
            String(!isCollapsed)
        );

        sidebarToggle.setAttribute(
            "aria-label",
            isCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
        );

        try {
            localStorage.setItem(
                "lungclassSidebarCollapsed",
                String(collapsed)
            );
        } catch {
            // Sidebar state still works when storage is unavailable.
        }
    }

    updateSidebarState(savedCollapsedState);

    sidebarToggle.addEventListener("click", () => {

        savedCollapsedState = !savedCollapsedState;
        updateSidebarState(savedCollapsedState);

    });

    desktopLayout.addEventListener("change", () => {
        updateSidebarState(savedCollapsedState);
    });

});

/* =========================================================
   ANIMATED OVERVIEW COUNTERS
   ========================================================= */

function animateCounter(element) {

    const target =
        Number.parseFloat(element.dataset.target);

    if (!Number.isFinite(target)) return;

    const suffix =
        element.dataset.suffix || "";

    const decimals =
        Number.parseInt(element.dataset.decimals || "2", 10);

    const formatValue = (value) =>
        `${value.toFixed(decimals)}${suffix}`;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        element.textContent = formatValue(target);
        return;
    }

    const duration = 1300;
    const startTime = performance.now();

    function updateCounter(currentTime) {

        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        const eased =
            1 - Math.pow(1 - progress, 3);

        element.textContent =
            formatValue(target * eased);

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = formatValue(target);
        }
    }

    requestAnimationFrame(updateCounter);
}

function observeAnimatedCounters() {

    const counters =
        document.querySelectorAll(".animated-counter");

    if (!("IntersectionObserver" in window)) {
        counters.forEach(animateCounter);
        return;
    }

    const counterObserver = new IntersectionObserver(
        (entries) => {

            entries.forEach((entry) => {

                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });

        },
        {
            threshold: 0.5
        }
    );

    counters.forEach((counter) => {
        counterObserver.observe(counter);
    });

}

document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("startupLoader")) {
        observeAnimatedCounters();
    }
});

/* =========================================================
   LIVE PIPELINE FLOW
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const overview =
        document.getElementById("overview");

    const pipelineSteps =
        overview?.querySelectorAll(".pipeline-step") || [];

    if (!pipelineSteps.length) return;

    const reducedMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) return;

    let pipelineIndex = 0;
    let pipelineInterval = null;

    function animatePipeline() {

        pipelineSteps.forEach((step) => {
            step.classList.remove("pipeline-active");
        });

        pipelineSteps[pipelineIndex].classList.add("pipeline-active");
        pipelineIndex = (pipelineIndex + 1) % pipelineSteps.length;
    }

    function updatePipelineAnimation() {

        const shouldAnimate =
            overview.classList.contains("active") && !document.hidden;

        if (shouldAnimate && pipelineInterval === null) {
            animatePipeline();
            pipelineInterval = setInterval(animatePipeline, 1100);
        } else if (!shouldAnimate && pipelineInterval !== null) {
            clearInterval(pipelineInterval);
            pipelineInterval = null;

            pipelineSteps.forEach((step) => {
                step.classList.remove("pipeline-active");
            });
        }
    }

    navButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setTimeout(updatePipelineAnimation, 0);
        });
    });

    document.addEventListener("visibilitychange", updatePipelineAnimation);
    updatePipelineAnimation();

});

/* =========================================================
   SYSTEM ACTIVITY TEXT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const activityText =
        document.getElementById("systemActivityText");

    if (!activityText) return;

    const messages = [
        "Ensemble system initialized",
        "Spirometry pipeline ready",
        "Four base learners available",
        "Stacking meta-learner ready",
        "Awaiting patient data"
    ];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    let messageIndex = 0;

    setInterval(() => {

        messageIndex = (messageIndex + 1) % messages.length;

        activityText.classList.remove("activity-text-change");
        void activityText.offsetWidth;
        activityText.textContent = messages[messageIndex];
        activityText.classList.add("activity-text-change");

    }, 3000);

});

/* =========================================================
   DYNAMIC BACKGROUND PARTICLES
   ========================================================= */

let backgroundParticles = [];

document.addEventListener("DOMContentLoaded", () => {

    const particleField =
        document.getElementById("particleField");

    if (!particleField) return;

    const particleCount =
        window.innerWidth < 768 ? 18 : 35;

    for (let index = 0; index < particleCount; index++) {

        const particle =
            document.createElement("span");

        particle.classList.add("bg-particle");
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        const floatDuration =
            10 + Math.random() * 15;

        const pulseDuration =
            2 + Math.random() * 3;

        particle.style.animationDuration =
            `${floatDuration}s, ${pulseDuration}s`;

        particle.style.animationDelay =
            `${Math.random() * -15}s, ${Math.random() * -3}s`;

        particleField.appendChild(particle);
    }

    backgroundParticles = Array.from(
        particleField.querySelectorAll(".bg-particle")
    );

});

/* =========================================================
   PARTICLE MOUSE REACTION
   ========================================================= */

let particlePointerFrame = null;

document.addEventListener("mousemove", (event) => {

    if (particlePointerFrame !== null) return;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    particlePointerFrame = requestAnimationFrame(() => {

        backgroundParticles.forEach((particle, index) => {

            if (index % 3 !== 0) return;

            const rect =
                particle.getBoundingClientRect();

            const distanceX =
                mouseX - (rect.left + rect.width / 2);

            const distanceY =
                mouseY - (rect.top + rect.height / 2);

            const distance =
                Math.sqrt(distanceX ** 2 + distanceY ** 2);

            if (distance < 140) {
                particle.style.translate =
                    `${-(distanceX / 15)}px ${-(distanceY / 15)}px`;
            } else {
                particle.style.translate = "0 0";
            }

        });

        particlePointerFrame = null;
    });

});

document.addEventListener("mouseleave", () => {
    backgroundParticles.forEach((particle, index) => {
        if (index % 3 === 0) {
            particle.style.translate = "0 0";
        }
    });
});

/* =========================================================
   DYNAMIC PAGE TRANSITIONS
   ========================================================= */

function animatePageSection(section) {

    if (!section) return;

    // Restart animation every time a page is opened
    section.classList.remove("section-animate-in");

    void section.offsetWidth;

    section.classList.add("section-animate-in");

    // Animate major children sequentially
    const children = Array.from(section.children);

    children.forEach((child, index) => {

        child.classList.remove("dynamic-reveal", "reveal-visible");

        child.classList.add("dynamic-reveal");

        setTimeout(() => {
            child.classList.add("reveal-visible");
        }, 70 * index);

    });
}

/* Detect sidebar navigation */
document.addEventListener("click", (event) => {

    const navItem = event.target.closest(
        ".nav-item, .sidebar a, [data-section]"
    );

    if (!navItem) return;

    /*
       Allow your existing navigation code to switch
       the section first.
    */
    setTimeout(() => {

        const activeSection =
            document.querySelector(".page-section.active") ||
            document.querySelector(".page-section:not([style*='display: none'])");

        animatePageSection(activeSection);

    }, 40);

});

/* =========================================================
   SCROLL REVEAL
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const revealTargets = document.querySelectorAll(
        ".stat-card, .metric-card, .info-card, .panel, " +
        ".performance-card, .method-card, .academic-info-card"
    );

    revealTargets.forEach((element) => {
        element.classList.add("scroll-reveal");
    });

    if (!("IntersectionObserver" in window)) {
        revealTargets.forEach((element) => {
            element.classList.add("scroll-visible");
        });
        return;
    }

    const revealObserver = new IntersectionObserver(
        (entries) => {

            entries.forEach((entry) => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("scroll-visible");

                    revealObserver.unobserve(entry.target);
                }
            });

        },
        {
            threshold: 0.12
        }
    );

    revealTargets.forEach((element) => {
        revealObserver.observe(element);
    });

});

document.addEventListener("DOMContentLoaded", () => {

    const chartImages = document.querySelectorAll(
        ".chart-card img, .chart-viewer img"
    );

    chartImages.forEach((image) => {

        image.classList.add("dynamic-chart-image");

        if (image.complete) {
            image.classList.add("image-loaded");
        }

        image.addEventListener("load", () => {
            image.classList.add("image-loaded");
        });

        image.addEventListener("error", () => {
            image.classList.add("image-loaded");
        });

    });

});