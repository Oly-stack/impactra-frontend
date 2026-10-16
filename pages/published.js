/* ==========================================
   SIDEBAR DRAWER
========================================== */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");

const openSidebarBtn = document.getElementById("openSidebar");
const closeSidebarBtn = document.getElementById("closeSidebar");

function openSidebar() {
  sidebar.classList.remove("-translate-x-full");
  overlay.classList.remove("hidden");

  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar.classList.add("-translate-x-full");
  overlay.classList.add("hidden");

  document.body.style.overflow = "";
}

openSidebarBtn.addEventListener("click", openSidebar);

closeSidebarBtn.addEventListener("click", closeSidebar);

overlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) {
    sidebar.classList.remove("-translate-x-full");
    overlay.classList.add("hidden");

    document.body.style.overflow = "";
  } else {
    sidebar.classList.add("-translate-x-full");
    overlay.classList.add("hidden");

    document.body.style.overflow = "";
  }
});

/* ==========================================
   OPPORTUNITY DATA
========================================== */

/*
  The page uses sample values by default.

  When integrating this with your create-opportunity
  form, save the form data to sessionStorage before
  navigating to this page.
*/

function loadOpportunityData() {
  let opportunity = {};

  try {
    opportunity = JSON.parse(
      sessionStorage.getItem("publishedOpportunity") || "{}",
    );
  } catch (error) {
    console.error("Could not read opportunity data:", error);
  }

  const setText = (id, value) => {
    const element = document.getElementById(id);

    if (element && value !== undefined && value !== null && value !== "") {
      element.textContent = value;
    }
  };

  setText("opportunityTitle", opportunity.name);
  setText("opportunityCategory", opportunity.category);
  setText("opportunityVenue", opportunity.venue);
  setText("opportunityRegion", opportunity.region);
  setText("opportunityDate", opportunity.date);
  setText("opportunityTime", opportunity.time);
  setText("organizationName", opportunity.organization);
  setText(
    "referenceNumber",
    opportunity.reference ? `REFERENCE: ${opportunity.reference}` : null,
  );

  if (opportunity.staffingTarget !== undefined) {
    const target = Number(opportunity.staffingTarget);

    if (Number.isFinite(target) && target >= 0) {
      setText("opportunityStaffing", `${target} Volunteers`);
      setText("staffingTarget", target);
    }
  }

  if (opportunity.confirmedCount !== undefined) {
    const confirmed = Number(opportunity.confirmedCount);

    if (Number.isFinite(confirmed) && confirmed >= 0) {
      setText("confirmedCount", confirmed);
    }
  }

  /* Update the shift phases if provided */

  if (Array.isArray(opportunity.phases)) {
    const phasesContainer = document.getElementById("shiftPhases");

    phasesContainer.replaceChildren();

    opportunity.phases.forEach((phase, index) => {
      const tag = document.createElement("span");

      tag.className = "shift-tag";
      tag.textContent = `${index + 1}. ${phase}`;

      phasesContainer.appendChild(tag);
    });
  }
}

loadOpportunityData();

/* ==========================================
   SHARE OPPORTUNITY
========================================== */

const shareButton = document.getElementById("shareOpportunityBtn");

shareButton.addEventListener("click", async () => {
  const title = document.getElementById("opportunityTitle").textContent.trim();

  const shareData = {
    title: title,
    text: `Check out this opportunity on Impactra: ${title}`,
    url: window.location.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(window.location.href);

      alert("Opportunity link copied to clipboard!");
    } else {
      window.prompt("Copy this opportunity link:", window.location.href);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Unable to share opportunity:", error);
      alert("Unable to share right now. Please try again.");
    }
  }
});
