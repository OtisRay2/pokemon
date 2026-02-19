import {
  login,
  logout,
  fetch as solidFetch,
  handleIncomingRedirect,
  getDefaultSession
} from "https://esm.sh/@inrupt/solid-client-authn-browser@3";
import {
  addStringNoLocale,
  addUrl,
  asUrl,
  createSolidDataset,
  createThing,
  getContainedResourceUrlAll,
  getSolidDataset,
  getSourceUrl,
  getStringNoLocale,
  getThingAll,
  getUrl,
  saveSolidDatasetAt,
  setThing
} from "https://esm.sh/@inrupt/solid-client@1.30.1";
import { RDF, SCHEMA_INRUPT } from "https://esm.sh/@inrupt/vocab-common-rdf@1.0.5";

const statusEl = document.querySelector("#status");
const solidStatusEl = document.querySelector("#solid-status");
const searchForm = document.querySelector("#search-form");
const loginForm = document.querySelector("#login-form");
const favoritesList = document.querySelector("#favorites-list");
const saveFavoriteButton = document.querySelector("#save-favorite");
const loadFavoritesButton = document.querySelector("#load-favorites");
const restoreSessionButton = document.querySelector("#restore-session");
const logoutButton = document.querySelector("#logout");

const pokemonCard = document.querySelector("#pokemon-card");
const pokemonImage = document.querySelector("#pokemon-image");
const pokemonTitle = document.querySelector("#pokemon-title");
const pokemonTypes = document.querySelector("#pokemon-types");
const pokemonAbilities = document.querySelector("#pokemon-abilities");
const pokemonHeight = document.querySelector("#pokemon-height");
const pokemonWeight = document.querySelector("#pokemon-weight");

let currentPokemon = null;
const session = getDefaultSession();
const FAVORITES_RESOURCE = "pokemon/favorites.ttl";

function setStatus(message) {
  statusEl.textContent = message;
}

function setSolidStatus(message) {
  solidStatusEl.textContent = message;
}

function parseStorageFromWebId(profileData, webId) {
  const profileThings = getThingAll(profileData);
  for (const thing of profileThings) {
    const id = asUrl(thing, getSourceUrl(profileData));
    if (id !== webId) continue;
    const storage = getUrl(thing, "http://www.w3.org/ns/pim/space#storage");
    if (storage) return storage;
  }
  return null;
}

async function getStorageRoot(webId) {
  const profileData = await getSolidDataset(webId, { fetch: solidFetch });
  const storage = parseStorageFromWebId(profileData, webId);
  if (!storage) throw new Error("Geen storage gevonden op je WebID-profiel.");
  return storage.endsWith("/") ? storage : `${storage}/`;
}

async function ensurePokemonContainer(storageRoot) {
  const publicContainerUrl = `${storageRoot}public/`;
  const publicDataset = await getSolidDataset(publicContainerUrl, { fetch: solidFetch });
  const pokemonContainerUrl = `${publicContainerUrl}pokemon/`;

  if (!getContainedResourceUrlAll(publicDataset).includes(pokemonContainerUrl)) {
    await solidFetch(pokemonContainerUrl, {
      method: "PUT",
      headers: {
        Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'
      }
    });
  }
}

async function getOrCreateFavoritesDataset() {
  const webId = session.info.webId;
  if (!webId) throw new Error("Geen actieve Solid sessie.");

  const storageRoot = await getStorageRoot(webId);
  await ensurePokemonContainer(storageRoot);
  const resourceUrl = `${storageRoot}public/${FAVORITES_RESOURCE}`;

  try {
    const existing = await getSolidDataset(resourceUrl, { fetch: solidFetch });
    return { dataset: existing, resourceUrl };
  } catch {
    const emptyDataset = createSolidDataset();
    const saved = await saveSolidDatasetAt(resourceUrl, emptyDataset, { fetch: solidFetch });
    return { dataset: saved, resourceUrl };
  }
}

async function saveFavoriteToPod() {
  if (!currentPokemon) return setStatus("Zoek eerst een Pokémon.");
  if (!session.info.isLoggedIn) return setSolidStatus("Log eerst in met Solid om op te slaan.");

  try {
    const { dataset, resourceUrl } = await getOrCreateFavoritesDataset();
    let item = createThing({ name: `pokemon-${currentPokemon.id}` });
    item = addUrl(item, RDF.type, SCHEMA_INRUPT.Thing);
    item = addStringNoLocale(item, SCHEMA_INRUPT.name, currentPokemon.name);
    item = addUrl(item, SCHEMA_INRUPT.url, currentPokemon.url);
    item = addStringNoLocale(item, SCHEMA_INRUPT.identifier, String(currentPokemon.id));

    const updated = setThing(dataset, item);
    await saveSolidDatasetAt(resourceUrl, updated, { fetch: solidFetch });
    setSolidStatus(`${currentPokemon.name} opgeslagen in ${FAVORITES_RESOURCE}`);
  } catch (error) {
    setSolidStatus(`Opslaan mislukt: ${error.message}`);
  }
}

async function loadFavoritesFromPod() {
  favoritesList.innerHTML = "";
  if (!session.info.isLoggedIn) return setSolidStatus("Log eerst in.");

  try {
    const { dataset } = await getOrCreateFavoritesDataset();
    const items = getThingAll(dataset)
      .map((thing) => ({
        name: getStringNoLocale(thing, SCHEMA_INRUPT.name),
        id: getStringNoLocale(thing, SCHEMA_INRUPT.identifier),
        url: getUrl(thing, SCHEMA_INRUPT.url)
      }))
      .filter((item) => item.name && item.id);

    if (!items.length) {
      favoritesList.innerHTML = "<li>Nog geen favorieten opgeslagen.</li>";
      return;
    }

    for (const item of items) {
      const li = document.createElement("li");
      li.innerHTML = item.url
        ? `<a href="${item.url}" target="_blank" rel="noreferrer">#${item.id} ${item.name}</a>`
        : `#${item.id} ${item.name}`;
      favoritesList.appendChild(li);
    }
  } catch (error) {
    setSolidStatus(`Favorieten laden mislukt: ${error.message}`);
  }
}

async function searchPokemon(query) {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${query.toLowerCase()}`);
  if (!response.ok) throw new Error("Pokémon niet gevonden");
  return response.json();
}

function renderPokemon(pokemon) {
  currentPokemon = {
    id: pokemon.id,
    name: pokemon.name,
    url: `https://www.pokemon.com/us/pokedex/${pokemon.name}`
  };

  pokemonImage.src = pokemon.sprites.front_default || "";
  pokemonImage.alt = pokemon.name;
  pokemonTitle.textContent = `#${pokemon.id} ${pokemon.name}`;
  pokemonTypes.textContent = pokemon.types.map((t) => t.type.name).join(", ");
  pokemonAbilities.textContent = pokemon.abilities.map((a) => a.ability.name).join(", ");
  pokemonHeight.textContent = (pokemon.height / 10).toString();
  pokemonWeight.textContent = (pokemon.weight / 10).toString();

  pokemonCard.classList.remove("hidden");
  saveFavoriteButton.disabled = !session.info.isLoggedIn;
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = document.querySelector("#pokemon-name").value.trim();
  if (!query) return;

  setStatus("Zoeken...");
  try {
    const pokemon = await searchPokemon(query);
    renderPokemon(pokemon);
    setStatus("Gevonden!");
  } catch (error) {
    pokemonCard.classList.add("hidden");
    setStatus(error.message);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const oidcIssuer = document.querySelector("#oidc-issuer").value;
  await login({
    oidcIssuer,
    clientName: "Pokemon Solid App",
    redirectUrl: window.location.href
  });
});

restoreSessionButton.addEventListener("click", async () => {
  await handleIncomingRedirect({ restorePreviousSession: true });
  if (session.info.isLoggedIn) {
    setSolidStatus(`Ingelogd als ${session.info.webId}`);
    saveFavoriteButton.disabled = false;
    loadFavoritesButton.disabled = false;
  } else {
    setSolidStatus("Geen actieve sessie gevonden.");
  }
});

logoutButton.addEventListener("click", async () => {
  if (session.info.isLoggedIn) await logout();
  saveFavoriteButton.disabled = true;
  loadFavoritesButton.disabled = true;
  setSolidStatus("Uitgelogd.");
});

saveFavoriteButton.addEventListener("click", saveFavoriteToPod);
loadFavoritesButton.addEventListener("click", loadFavoritesFromPod);

await handleIncomingRedirect({ restorePreviousSession: true });
if (session.info.isLoggedIn) {
  setSolidStatus(`Ingelogd als ${session.info.webId}`);
  saveFavoriteButton.disabled = false;
  loadFavoritesButton.disabled = false;
}
