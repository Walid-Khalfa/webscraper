import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/jobs";
const API_ROOT_URL = API_BASE_URL.replace("/api/jobs", "/api");

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export async function searchJobs({ keyword, location, page = 1, size = 25 }) {
  const response = await client.get("/search", {
    params: { keyword, location, page, size },
  });
  return response.data;
}

export async function exportJobsCsv({ keyword, location }) {
  const response = await client.get("/export/csv", {
    params: { keyword, location },
    responseType: "blob",
  });
  return response.data;
}

export async function createAgency({ name, email, plan }) {
  const response = await axios.post(`${API_ROOT_URL}/agencies`, { name, email, plan }, { timeout: 10000 });
  return response.data;
}

function agencyHeaders(apiKey) {
  return { "X-Agency-Key": apiKey };
}

export async function listSubscriptions(apiKey) {
  const response = await axios.get(
    `${API_ROOT_URL}/alerts/subscriptions`,
    { headers: agencyHeaders(apiKey), timeout: 10000 },
  );
  return response.data;
}

export async function createSubscription(apiKey, payload) {
  const response = await axios.post(
    `${API_ROOT_URL}/alerts/subscriptions`,
    payload,
    { headers: agencyHeaders(apiKey), timeout: 10000 },
  );
  return response.data;
}

export async function sendSubscriptionNow(apiKey, subscriptionId) {
  const response = await axios.post(
    `${API_ROOT_URL}/alerts/subscriptions/${subscriptionId}/send-now`,
    {},
    { headers: agencyHeaders(apiKey), timeout: 30000 },
  );
  return response.data;
}
