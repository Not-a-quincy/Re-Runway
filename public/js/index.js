// Micro-interaction for staggered grid image scale hover effects
document.querySelectorAll('.neo-shadow').forEach((card) => {
  card.addEventListener('mouseenter', () => {
    const innerImg = card.querySelector('img');

    if (innerImg) {
      innerImg.style.transition = 'transform 0.3s ease';
      innerImg.style.transform = 'scale(1.05)';
    }
  });

  card.addEventListener('mouseleave', () => {
    const innerImg = card.querySelector('img');

    if (innerImg) {
      innerImg.style.transform = 'scale(1)';
    }
  });
});

// Simple scroll parallax for background accents
window.addEventListener('scroll', () => {
  const symbols = document.querySelectorAll('.hero .material-symbols-outlined');
  const scrolled = window.pageYOffset;

  symbols.forEach((symbol, index) => {
    const speed = (index + 1) * 0.1;
    symbol.style.transform = `translateY(${scrolled * speed}px) rotate(${scrolled * 0.05}deg)`;
  });
});


let banners = [];
let currentBannerIndex = 0;

async function initBannerRotation() {
  try {
    const response = await fetch('/api/banners');
    banners = await response.json();

    if (banners && banners.length > 0) {
      updateBannerUI(banners[currentBannerIndex]);

      if (banners.length > 1) {
        setInterval(() => {
          currentBannerIndex = (currentBannerIndex + 1) % banners.length;
          updateBannerUI(banners[currentBannerIndex]);
        }, 10000);
      }
    }
  } catch (err) {
    console.error('Failed to load banners:', err);
  }
}

function updateBannerUI(banner) {
  const heroBanner = document.getElementById('hero-banner');
  const heroTitle = document.getElementById('hero-title');
  const heroSubtitle = document.getElementById('hero-subtitle');

  if (!heroBanner) return;

  if (heroTitle && banner.title) {
    heroTitle.textContent = banner.title;
  }

  if (heroSubtitle && banner.subtitle) {
    heroSubtitle.textContent = banner.subtitle;
  }

  if (banner.image_url) {
    const url = banner.image_url.trim();
    heroBanner.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.75) 100%), url("${url}")`;
  }
}

document.addEventListener('DOMContentLoaded', initBannerRotation);