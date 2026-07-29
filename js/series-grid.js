const TMDB_API =
    "https://api.themoviedb.org/3";

const TMDB_IMAGE =
    "https://image.tmdb.org/t/p/w780";

const FAVORITES_KEY =
    "slideflix-tmdb-favorites";

const rowRequests = [
    ["Trending now", "/trending/movie/week"],
    ["Popular", "/movie/popular"],
    ["Now playing", "/movie/now_playing"],
    ["Top rated", "/movie/top_rated"],
    ["Coming soon", "/movie/upcoming"]
];

/* Main page elements */

const rowsContainer =
    document.querySelector("#series-rows");

const favoritesGrid =
    document.querySelector("#favorites-grid");

const catalogHeading =
    document.querySelector(
        ".catalog__heading"
    );

/* Hover preview elements */

const moviePreview =
    document.querySelector("#movie-preview");

const previewImage =
    moviePreview.querySelector(
        ".movie-preview__image"
    );

const previewTitle =
    moviePreview.querySelector(
        "#movie-preview-title"
    );

const previewMeta =
    moviePreview.querySelector(
        ".movie-preview__meta"
    );

const previewDescription =
    moviePreview.querySelector(
        ".movie-preview__description"
    );

const previewFavorite =
    moviePreview.querySelector(
        ".movie-preview__favorite"
    );

const previewClose =
    moviePreview.querySelector(
        ".movie-preview__close"
    );

let genres = {};

let previewMovie = null;
let previewOpenTimer;
let previewCloseTimer;

/* Load saved favorites */

let favoriteMovies = new Map(
    JSON.parse(
        localStorage.getItem(
            FAVORITES_KEY
        ) || "[]"
    ).map((movie) => [
        String(movie.id),
        movie
    ])
);

/* TMDB API */

function tmdbFetch(path) {
    const token =
        window.TMDB_READ_TOKEN;

    const apiKey =
        window.TMDB_API_KEY;

    const hasToken =
        token &&
        !token.includes("PASTE_YOUR");

    const hasApiKey =
        apiKey &&
        !apiKey.includes("PASTE_YOUR");

    if (!hasToken && !hasApiKey) {
        throw new Error(
            "Add your TMDB token or API key to js/tmdb-config.js"
        );
    }

    const separator =
        path.includes("?") ? "&" : "?";

    const url =
        hasApiKey && !hasToken
            ? `${TMDB_API}${path}${separator}api_key=${encodeURIComponent(
                apiKey
            )}`
            : `${TMDB_API}${path}`;

    return fetch(url, {
        headers: hasToken
            ? {
                Authorization:
                    `Bearer ${token}`,
                accept: "application/json"
            }
            : {
                accept: "application/json"
            }
    }).then((response) => {
        if (!response.ok) {
            throw new Error(
                `TMDB request failed (${response.status})`
            );
        }

        return response.json();
    });
}

/* Convert TMDB data into simpler movie objects */

function normalizeMovie(movie) {
    return {
        id: movie.id,

        title:
            movie.title ||
            movie.original_title ||
            "Untitled",

        overview:
            movie.overview ||
            "No description is available.",

        releaseDate:
            movie.release_date || "",

        rating:
            Number(
                movie.vote_average || 0
            ),

        genreIds:
            movie.genre_ids || [],

        imagePath:
            movie.backdrop_path ||
            movie.poster_path ||
            ""
    };
}

function movieGenre(movie) {
    const genreNames =
        movie.genreIds
            .map((genreId) => {
                return genres[genreId];
            })
            .filter(Boolean)
            .slice(0, 2);

    return (
        genreNames.join(" · ") ||
        "Movie"
    );
}

function movieYear(movie) {
    if (!movie.releaseDate) {
        return "Coming soon";
    }

    return movie.releaseDate.slice(0, 4);
}

function movieImage(movie) {
    if (!movie.imagePath) {
        return "https://placehold.co/780x440/202020/ffffff?text=No+image";
    }

    return `${TMDB_IMAGE}${movie.imagePath}`;
}

/* Movie cards */

function createCard(movie) {
    const card =
        document.createElement("article");

    const movieId =
        String(movie.id);

    const isFavorite =
        favoriteMovies.has(movieId);

    card.className = "series-card";
    card.dataset.movieId = movieId;

    card.innerHTML = `
        <img
            src="${movieImage(movie)}"
            alt="Artwork for ${movie.title}"
            loading="lazy"
        />

        <button
            class="favorite-button ${isFavorite
            ? "is-favorite"
            : ""
        }"
            type="button"
            aria-label="${isFavorite
            ? "Remove"
            : "Add"
        } ${movie.title} ${isFavorite
            ? "from"
            : "to"
        } favorites"
            aria-pressed="${isFavorite}"
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
            >
                <path
                    d="M12 21s-7.5-4.7-9.7-9C.4 8.2 2.4 4 6.7 4c2.3 0 4.1 1.4 5.3 3 1.2-1.6 3-3 5.3-3 4.3 0 6.3 4.2 4.4 8C19.5 16.3 12 21 12 21Z"
                />
            </svg>
        </button>

        <div class="series-card__overlay">
            <button
                class="play-button"
                type="button"
                aria-label="Play ${movie.title}"
            >
                ▶
            </button>

            <div>
                <h4>${movie.title}</h4>

                <p>
                    ${movieGenre(movie)}
                    · ${movieYear(movie)}
                    · ★ ${movie.rating.toFixed(1)}
                </p>

                <span>
                    ${movie.overview}
                </span>
            </div>
        </div>
    `;

    const favoriteButton =
        card.querySelector(
            ".favorite-button"
        );

    const playButton =
        card.querySelector(
            ".play-button"
        );

    favoriteButton.addEventListener(
        "pointerdown",
        (event) => {
            event.stopPropagation();
        }
    );

    favoriteButton.addEventListener(
        "click",
        (event) => {
            event.stopPropagation();

            toggleFavorite(movie);
            favoriteButton.blur();
        }
    );

    playButton.addEventListener(
        "click",
        () => {
            playButton.blur();
        }
    );

    card.addEventListener(
        "mouseenter",
        () => {
            scheduleMoviePreview(
                movie,
                card
            );
        }
    );

    card.addEventListener(
        "mouseleave",
        schedulePreviewClose
    );

    return card;
}

/* Favorites */

function saveFavorites() {
    const movies = [
        ...favoriteMovies.values()
    ];

    localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(movies)
    );
}

function toggleFavorite(movie) {
    const movieId =
        String(movie.id);

    if (
        favoriteMovies.has(movieId)
    ) {
        favoriteMovies.delete(movieId);
    } else {
        favoriteMovies.set(
            movieId,
            movie
        );
    }

    saveFavorites();
    updateFavoriteButtons(movieId);
    renderFavorites();
}

function updateFavoriteButtons(movieId) {
    const isFavorite =
        favoriteMovies.has(movieId);

    document
        .querySelectorAll(
            `[data-movie-id="${movieId}"]`
        )
        .forEach((card) => {
            const button =
                card.querySelector(
                    ".favorite-button"
                );

            button.classList.toggle(
                "is-favorite",
                isFavorite
            );

            button.setAttribute(
                "aria-pressed",
                String(isFavorite)
            );
        });

    if (
        previewMovie &&
        String(previewMovie.id) ===
        movieId
    ) {
        updatePreviewFavorite();
    }
}

function renderFavorites() {
    favoritesGrid.replaceChildren();

    const movies = [
        ...favoriteMovies.values()
    ];

    if (movies.length === 0) {
        const message =
            document.createElement("p");

        message.className =
            "favorites-empty";

        message.textContent =
            "You have not favorited any movies yet.";

        favoritesGrid.appendChild(
            message
        );

        return;
    }

    movies.forEach((movie) => {
        favoritesGrid.appendChild(
            createCard(movie)
        );
    });
}

/* Hover preview */

function updatePreviewFavorite() {
    if (!previewMovie) {
        return;
    }

    const movieId =
        String(previewMovie.id);

    const isFavorite =
        favoriteMovies.has(movieId);

    previewFavorite.classList.toggle(
        "is-favorite",
        isFavorite
    );

    previewFavorite.setAttribute(
        "aria-pressed",
        String(isFavorite)
    );

    previewFavorite.innerHTML = `
        <span aria-hidden="true">
            ${isFavorite ? "♥" : "♡"}
        </span>

        ${isFavorite
            ? "Favorited"
            : "Favorite"
        }
    `;
}

function positionMoviePreview(card) {
    const cardRect =
        card.getBoundingClientRect();

    const panelWidth =
        Math.min(
            440,
            window.innerWidth - 32
        );

    const panelHeight =
        moviePreview.offsetHeight;

    const screenEdge = 16;
    const gap = 12;

    let left =
        cardRect.right + gap;

    /*
     * If there is not enough room on
     * the right, show it on the left.
     */

    if (
        left + panelWidth >
        window.innerWidth - screenEdge
    ) {
        left =
            cardRect.left -
            panelWidth -
            gap;
    }

    left = Math.max(
        screenEdge,
        Math.min(
            left,
            window.innerWidth -
            panelWidth -
            screenEdge
        )
    );

    const top = Math.max(
        screenEdge,
        Math.min(
            cardRect.top - 70,
            window.innerHeight -
            panelHeight -
            screenEdge
        )
    );

    moviePreview.style.width =
        `${panelWidth}px`;

    moviePreview.style.left =
        `${left}px`;

    moviePreview.style.top =
        `${top}px`;
}

function openMoviePreview(
    movie,
    card
) {
    clearTimeout(previewCloseTimer);

    previewMovie = movie;

    previewImage.src =
        movieImage(movie);

    previewImage.alt =
        `Artwork for ${movie.title}`;

    previewTitle.textContent =
        movie.title;

    previewMeta.textContent =
        `${movieGenre(movie)} · ` +
        `${movieYear(movie)} · ` +
        `★ ${movie.rating.toFixed(1)}`;

    previewDescription.textContent =
        movie.overview;

    updatePreviewFavorite();

    moviePreview.classList.remove(
        "is-hidden"
    );

    positionMoviePreview(card);

    requestAnimationFrame(() => {
        moviePreview.classList.add(
            "is-visible"
        );
    });
}

function scheduleMoviePreview(
    movie,
    card
) {
    clearTimeout(previewCloseTimer);
    clearTimeout(previewOpenTimer);

    previewOpenTimer = setTimeout(
        () => {
            openMoviePreview(
                movie,
                card
            );
        },
        400
    );
}

function schedulePreviewClose() {
    clearTimeout(previewOpenTimer);
    clearTimeout(previewCloseTimer);

    previewCloseTimer = setTimeout(
        closeMoviePreview,
        160
    );
}

function closeMoviePreview() {
    clearTimeout(previewOpenTimer);

    moviePreview.classList.remove(
        "is-visible"
    );

    setTimeout(() => {
        const isStillClosed =
            !moviePreview.classList.contains(
                "is-visible"
            );

        if (isStillClosed) {
            moviePreview.classList.add(
                "is-hidden"
            );

            previewMovie = null;
        }
    }, 180);
}

/* Hover preview controls */

moviePreview.addEventListener(
    "mouseenter",
    () => {
        clearTimeout(
            previewCloseTimer
        );
    }
);

moviePreview.addEventListener(
    "mouseleave",
    schedulePreviewClose
);

previewClose.addEventListener(
    "click",
    closeMoviePreview
);

previewFavorite.addEventListener(
    "click",
    () => {
        if (!previewMovie) {
            return;
        }

        toggleFavorite(
            previewMovie
        );

        updatePreviewFavorite();
        previewFavorite.blur();
    }
);

document.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Escape") {
            closeMoviePreview();
        }
    }
);

document.addEventListener(
    "scroll",
    closeMoviePreview,
    true
);

/* Horizontal movie rows */

function createRow(title, movies) {
    const row =
        document.createElement("section");

    row.className = "series-row";

    row.innerHTML = `
        <h3>${title}</h3>

        <div
            class="series-track"
            aria-label="${title}"
        ></div>
    `;

    const track =
        row.querySelector(
            ".series-track"
        );

    movies
        .filter(
            (movie) =>
                movie.imagePath
        )
        .forEach((movie) => {
            track.appendChild(
                createCard(movie)
            );
        });

    rowsContainer.appendChild(row);

    enableRowDragging(track);
}

function enableRowDragging(track) {
    let dragging = false;
    let startingX = 0;
    let startingScroll = 0;

    track.addEventListener(
        "pointerdown",
        (event) => {
            if (
                event.target.closest(
                    "button"
                )
            ) {
                return;
            }

            closeMoviePreview();

            dragging = true;
            startingX =
                event.clientX;

            startingScroll =
                track.scrollLeft;

            track.setPointerCapture(
                event.pointerId
            );

            track.classList.add(
                "is-dragging"
            );
        }
    );

    track.addEventListener(
        "pointermove",
        (event) => {
            if (!dragging) {
                return;
            }

            track.scrollLeft =
                startingScroll -
                (event.clientX -
                    startingX);
        }
    );

    [
        "pointerup",
        "pointercancel"
    ].forEach((eventName) => {
        track.addEventListener(
            eventName,
            () => {
                dragging = false;

                track.classList.remove(
                    "is-dragging"
                );
            }
        );
    });
}

/* Single featured hero movie */

function populateHero(movies) {
    const movie = movies[0];

    const hero =
        document.querySelector(
            ".featured"
        );

    if (!movie || !hero) {
        return;
    }

    const heroImage =
        hero.querySelector(
            ".slide__image"
        );

    const heroTitle =
        hero.querySelector("h1");

    const heroMeta =
        hero.querySelector(".meta");

    const heroDescription =
        hero.querySelector(
            ".description"
        );

    heroImage.style.backgroundImage =
        `url("${movieImage(movie)}")`;

    heroTitle.textContent =
        movie.title;

    heroMeta.innerHTML = `
        <span>
            ${movieYear(movie)}
        </span>

        <span>
            ${movieGenre(movie)}
        </span>

        <span class="rating">
            ★ ${movie.rating.toFixed(1)}
        </span>
    `;

    heroDescription.textContent =
        movie.overview;

    hero.classList.remove(
        "is-loading"
    );
}

/* Loading and error handling */

function showError(error) {
    rowsContainer.innerHTML = `
        <p class="api-error">
            ${error.message}
        </p>
    `;

    catalogHeading
        .querySelector("h2")
        .textContent =
        "Movies could not load";
}

async function loadMovies() {
    try {
        const requests = [
            tmdbFetch(
                "/genre/movie/list?language=en-US"
            ),

            ...rowRequests.map(
                ([title, path]) => {
                    return tmdbFetch(
                        `${path}?language=en-US&page=1`
                    );
                }
            )
        ];

        const [
            genreData,
            ...rowData
        ] = await Promise.all(
            requests
        );

        genres = Object.fromEntries(
            genreData.genres.map(
                (genre) => [
                    genre.id,
                    genre.name
                ]
            )
        );

        rowsContainer.replaceChildren();

        rowData.forEach(
            (data, index) => {
                const movies =
                    data.results.map(
                        normalizeMovie
                    );

                createRow(
                    rowRequests[index][0],
                    movies
                );

                if (index === 0) {
                    populateHero(movies);
                }
            }
        );

        renderFavorites();
    } catch (error) {
        showError(error);
    }
}

/* Home and Favorites navigation */

const hero =
    document.querySelector(
        ".featured"
    );

const catalog =
    document.querySelector(
        ".catalog"
    );

const favoritesPage =
    document.querySelector(
        ".favorites-page"
    );

const viewLinks =
    document.querySelectorAll(
        "[data-view]"
    );

function showView(view) {
    closeMoviePreview();

    const showingFavorites =
        view === "favorites";

    hero.classList.toggle(
        "is-hidden",
        showingFavorites
    );

    catalog.classList.toggle(
        "is-hidden",
        showingFavorites
    );

    favoritesPage.classList.toggle(
        "is-hidden",
        !showingFavorites
    );

    viewLinks.forEach((link) => {
        link.classList.toggle(
            "active",
            link.dataset.view === view
        );
    });

    if (showingFavorites) {
        renderFavorites();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

viewLinks.forEach((link) => {
    link.addEventListener(
        "click",
        (event) => {
            event.preventDefault();

            showView(
                link.dataset.view
            );

            history.replaceState(
                null,
                "",
                link.getAttribute("href")
            );
        }
    );
});

if (
    window.location.hash ===
    "#favorites"
) {
    showView("favorites");
}

renderFavorites();
loadMovies();