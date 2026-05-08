// ==========================================
// THEME TOGGLE
// ==========================================

// Check for saved theme preference or default to dark mode
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
  document.body.classList.add('light-mode');
}

// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');

  // Save theme preference
  const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
});

// ==========================================
// SMOOTH SCROLLING & NAVIGATION
// ==========================================

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

menuToggle.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

// Close mobile menu when clicking a link
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('active');
  });
});

// Navbar scroll effect
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > 100) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  lastScroll = currentScroll;
});

// ==========================================
// TYPING ANIMATION
// ==========================================

const typingText = document.getElementById('typingText');
const phrases = [
  'a Developer',
  'a Python Expert',
  'a Golang Enthusiast',
  'a Problem Solver'
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 100;

function typeEffect() {
  const currentPhrase = phrases[phraseIndex];

  if (isDeleting) {
    // Remove character
    typingText.textContent = currentPhrase.substring(0, charIndex - 1);
    charIndex--;
    typingSpeed = 50;
  } else {
    // Add character
    typingText.textContent = currentPhrase.substring(0, charIndex + 1);
    charIndex++;
    typingSpeed = 100;
  }

  // Check if word is complete
  if (!isDeleting && charIndex === currentPhrase.length) {
    // Pause at end of phrase
    typingSpeed = 2000;
    isDeleting = true;
  } else if (isDeleting && charIndex === 0) {
    // Move to next phrase
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    typingSpeed = 500;
  }

  setTimeout(typeEffect, typingSpeed);
}

// Start typing effect after page load
window.addEventListener('load', () => {
  setTimeout(typeEffect, 1000);
});

// ==========================================
// SCROLL ANIMATIONS
// ==========================================

// Intersection Observer for fade-in animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');

      // Trigger progress bar animations for skill cards
      if (entry.target.classList.contains('skill-card')) {
        const progressFill = entry.target.querySelector('.progress-fill');
        if (progressFill) {
          progressFill.style.width = progressFill.style.getPropertyValue('--progress-width');
        }
      }
    }
  });
}, observerOptions);

// Observe all fade-in elements
document.querySelectorAll('.fade-in').forEach(el => {
  observer.observe(el);
});

// Observe skill cards for progress animation
document.querySelectorAll('.skill-card').forEach(el => {
  observer.observe(el);
});

// ==========================================
// FLOATING PARTICLES
// ==========================================

const particlesContainer = document.getElementById('particles');
const particleCount = 20;

function createParticle() {
  const particle = document.createElement('div');
  particle.classList.add('particle');

  // Random horizontal position
  const startX = Math.random() * 100;
  particle.style.left = `${startX}%`;

  // Random animation delay
  const delay = Math.random() * 20;
  particle.style.animationDelay = `${delay}s`;

  // Random size variation
  const size = 2 + Math.random() * 4;
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;

  particlesContainer.appendChild(particle);
}

// Create particles
for (let i = 0; i < particleCount; i++) {
  createParticle();
}

// ==========================================
// PARALLAX EFFECT
// ==========================================

window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;
  const heroContent = document.querySelector('.hero-content');

  if (heroContent && scrolled < window.innerHeight) {
    heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
    heroContent.style.opacity = 1 - (scrolled / window.innerHeight);
  }
});

// ==========================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ==========================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');

    if (targetId === '#') return;

    const targetElement = document.querySelector(targetId);

    if (targetElement) {
      const navHeight = navbar.offsetHeight;
      const targetPosition = targetElement.offsetTop - navHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  });
});

// ==========================================
// ACTIVE NAVIGATION LINK HIGHLIGHTING
// ==========================================

const sections = document.querySelectorAll('section[id]');

function highlightNavigation() {
  const scrollY = window.pageYOffset;

  sections.forEach(section => {
    const sectionHeight = section.offsetHeight;
    const sectionTop = section.offsetTop - 150;
    const sectionId = section.getAttribute('id');
    const navLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);

    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      if (navLink) {
        document.querySelectorAll('.nav-links a').forEach(link => {
          link.classList.remove('active');
        });
        navLink.classList.add('active');
      }
    }
  });
}

window.addEventListener('scroll', highlightNavigation);

// ==========================================
// SKILL CARD HOVER EFFECTS
// ==========================================

const skillCards = document.querySelectorAll('.skill-card');

skillCards.forEach(card => {
  card.addEventListener('mouseenter', function () {
    this.style.transform = 'translateY(-10px) scale(1.02)';
  });

  card.addEventListener('mouseleave', function () {
    this.style.transform = 'translateY(0) scale(1)';
  });
});

// ==========================================
// PROJECT CARD ANIMATIONS
// ==========================================

const projectCards = document.querySelectorAll('.project-card');

projectCards.forEach(card => {
  card.addEventListener('mouseenter', function () {
    // Add a subtle tilt effect
    this.style.transform = 'translateY(-10px) rotateX(2deg)';
  });

  card.addEventListener('mouseleave', function () {
    this.style.transform = 'translateY(0) rotateX(0deg)';
  });

  // Add click animation
  card.addEventListener('click', function () {
    this.style.transform = 'scale(0.98)';
    setTimeout(() => {
      this.style.transform = 'translateY(-10px)';
    }, 100);
  });
});

// ==========================================
// PERFORMANCE OPTIMIZATION
// ==========================================

// Debounce scroll events
let scrollTimeout;
window.addEventListener('scroll', () => {
  if (scrollTimeout) {
    window.cancelAnimationFrame(scrollTimeout);
  }

  scrollTimeout = window.requestAnimationFrame(() => {
    // Scroll-dependent functions are already called above
  });
});

// ==========================================
// PRELOAD ANIMATIONS
// ==========================================

window.addEventListener('load', () => {
  // Add loaded class to body for additional animations
  document.body.classList.add('loaded');

  // Initialize any additional animations or effects
  console.log('Portfolio loaded successfully! 🚀');
});

// ==========================================
// ACCESSIBILITY ENHANCEMENTS
// ==========================================

// Keyboard navigation for project cards
projectCards.forEach(card => {
  card.setAttribute('tabindex', '0');

  card.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.click();
    }
  });
});

// ==========================================
// GITHUB PROJECTS INTEGRATION
// ==========================================

const GITHUB_USERNAME = 'Felix-Dcc';
const GITHUB_API_URL = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=12`;

// Language to emoji/icon mapping
const languageIcons = {
  'Python': { icon: '🐍', gradient: 'linear-gradient(135deg, #3776ab 0%, #ffd43b 100%)' },
  'Go': { icon: '🔷', gradient: 'linear-gradient(135deg, #00ADD8 0%, #5DC9E2 100%)' },
  'JavaScript': { icon: '🟨', gradient: 'linear-gradient(135deg, #f7df1e 0%, #e8d44d 100%)' },
  'TypeScript': { icon: '🔷', gradient: 'linear-gradient(135deg, #3178c6 0%, #235a97 100%)' },
  'HTML': { icon: '🌐', gradient: 'linear-gradient(135deg, #e34c26 0%, #f06529 100%)' },
  'CSS': { icon: '🎨', gradient: 'linear-gradient(135deg, #264de4 0%, #2965f1 100%)' },
  'Rust': { icon: '🦀', gradient: 'linear-gradient(135deg, #dea584 0%, #b7410e 100%)' },
  'Java': { icon: '☕', gradient: 'linear-gradient(135deg, #007396 0%, #ed8b00 100%)' },
  'C++': { icon: '⚙️', gradient: 'linear-gradient(135deg, #00599C 0%, #004482 100%)' },
  'C': { icon: '🔧', gradient: 'linear-gradient(135deg, #555555 0%, #A8B9CC 100%)' },
  'Shell': { icon: '🐚', gradient: 'linear-gradient(135deg, #89e051 0%, #4e9a06 100%)' },
  'default': { icon: '📁', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
};

// Get language info
function getLanguageInfo(language) {
  return languageIcons[language] || languageIcons['default'];
}

// Create a project card HTML
function createProjectCard(repo) {
  const langInfo = getLanguageInfo(repo.language);
  const description = repo.description || 'No description provided';
  const topics = repo.topics && repo.topics.length > 0
    ? repo.topics.slice(0, 4)
    : (repo.language ? [repo.language] : ['Code']);

  return `
    <div class="project-card fade-in visible">
      <div class="project-image" style="background: ${langInfo.gradient};">
        ${langInfo.icon}
      </div>
      <div class="project-content">
        <h3 class="project-title">${repo.name}</h3>
        <p class="project-description">${description}</p>
        <div class="project-tags">
          ${topics.map(topic => `<span class="tag">${topic}</span>`).join('')}
        </div>
        <div class="project-links">
          <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="project-link">View Code →</a>
          ${repo.homepage ? `<a href="${repo.homepage}" target="_blank" rel="noopener noreferrer" class="project-link">Live Demo →</a>` : ''}
        </div>
      </div>
    </div>
  `;
}

// Create loading skeleton
function createLoadingSkeleton() {
  return `
    <div class="project-card loading-skeleton">
      <div class="project-image skeleton-bg"></div>
      <div class="project-content">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-text"></div>
        <div class="skeleton-line skeleton-text short"></div>
        <div class="skeleton-tags">
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
        </div>
      </div>
    </div>
  `;
}

// Fetch and display GitHub projects
async function loadGitHubProjects() {
  const projectsContainer = document.getElementById('projects-container');

  if (!projectsContainer) {
    console.log('Projects container not found, using static projects');
    return;
  }

  // Show loading state
  projectsContainer.innerHTML = Array(3).fill(createLoadingSkeleton()).join('');

  try {
    const response = await fetch(GITHUB_API_URL);

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();

    // Filter out forked repos and sort by stars/updates
    const ownRepos = repos
      .filter(repo => !repo.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at));

    if (ownRepos.length === 0) {
      projectsContainer.innerHTML = `
        <div class="empty-state">
          <p>📂 No public repositories yet. Check back soon!</p>
        </div>
      `;
      return;
    }

    // Render project cards
    projectsContainer.innerHTML = ownRepos.map(createProjectCard).join('');

    // Re-attach animations to new cards
    attachProjectCardAnimations();

  } catch (error) {
    console.error('Failed to load GitHub projects:', error);
    projectsContainer.innerHTML = `
      <div class="error-state">
        <p>⚠️ Unable to load projects. Please check back later.</p>
        <a href="https://github.com/${GITHUB_USERNAME}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
          View on GitHub →
        </a>
      </div>
    `;
  }
}

// Attach animations to dynamically loaded project cards
function attachProjectCardAnimations() {
  const newProjectCards = document.querySelectorAll('#projects-container .project-card');

  newProjectCards.forEach(card => {
    card.setAttribute('tabindex', '0');

    card.addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-10px) rotateX(2deg)';
    });

    card.addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0) rotateX(0deg)';
    });

    card.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const link = this.querySelector('.project-link');
        if (link) link.click();
      }
    });

    // Observe for fade-in animation
    observer.observe(card);
  });
}

// Load GitHub projects when DOM is ready
document.addEventListener('DOMContentLoaded', loadGitHubProjects);
