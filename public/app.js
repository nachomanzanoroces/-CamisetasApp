// -CamisetasApp - Core Frontend JavaScript Engine
// Zero-dependency SPA Controller for Real Oviedo T-shirts App

// Configuration: Set true to bypass/disable onboarding login wall for the public demo version
// Can be toggled back to false to re-enable standard authentication/onboarding features
const DISABLE_LOGIN_WALL_FOR_DEMO = true;

const IS_STATIC_HOST = window.location.hostname.endsWith("github.io") || 
                       window.location.hostname.includes("githubpreview.dev") || 
                       window.location.protocol === "file:" ||
                       new URLSearchParams(window.location.search).get("mock") === "true";

// Mock Database Initializer for static hosting (force re-initialization if version is not v2)
if (IS_STATIC_HOST && localStorage.getItem("mock_db_initialized") !== "v2") {
  const initialUsers = [
    { id: 999, name: "Invitado Demo", tlf_number: "999", role: "admin", status: "approved", password_hash: "demo" },
    { id: 600000000, name: "Dani Administrador", tlf_number: "600000000", role: "admin", status: "approved", password_hash: "admin" },
    { id: 611111111, name: "Usuario Aprobado", tlf_number: "611111111", role: "user", status: "approved", password_hash: "user" },
    { id: 622222222, name: "Usuario Pendiente", tlf_number: "622222222", role: "user", status: "pending", password_hash: "user" }
  ];
  
  const initialCatalogue = [
    { 
      id: 1, 
      name: "Camiseta Oficial Real Oviedo Primera Equipación (China Premium)", 
      description: "Réplica de altísima calidad de la camiseta oficial del Real Oviedo. Tejido transpirable con escudo bordado y todos los detalles patrocinados. Versión 2025/2026.", 
      image_url: "uploads/oviedo_primary.jpg", 
      status: "requested", 
      created_by: 600000000, 
      created_at: new Date().toISOString() 
    },
    { 
      id: 2, 
      name: "Camiseta Alternativa Rosa y Blanca Real Oviedo", 
      description: "Diseño exclusivo alternativo sugerido por el grupo. Color rosa con cuello y detalles blancos retro.", 
      image_url: "uploads/oviedo_alternative.jpg", 
      status: "suggested", 
      created_by: 600000000, 
      created_at: new Date().toISOString() 
    }
  ];

  const initialPolls = [
    { 
      id: 1, 
      catalogue_id: 2, 
      question: "¿Qué os parece traer la camiseta alternativa rosa de Oviedo para este lote?", 
      options: JSON.stringify(["Me encanta, contad conmigo", "Prefiero solo la clásica azul", "No me convence el diseño"]), 
      status: "active", 
      created_at: new Date().toISOString() 
    }
  ];

  localStorage.setItem("mock_users", JSON.stringify(initialUsers));
  localStorage.setItem("mock_catalogue", JSON.stringify(initialCatalogue));
  localStorage.setItem("mock_votes", JSON.stringify([
    { user_id: 611111111, catalogue_id: 2 },
    { user_id: 999, catalogue_id: 2 }
  ]));
  localStorage.setItem("mock_polls", JSON.stringify(initialPolls));
  localStorage.setItem("mock_poll_votes", JSON.stringify([
    { poll_id: 1, user_id: 611111111, selected_option: "Me encanta, contad conmigo" },
    { poll_id: 1, user_id: 999, selected_option: "Me encanta, contad conmigo" }
  ]));
  localStorage.setItem("mock_orders", JSON.stringify([
    { 
      id: 1, 
      user_id: 611111111, 
      catalogue_id: 1, 
      quantity: 2, 
      sizes_json: JSON.stringify({ "M": 1, "L": 1 }), 
      total_price: 56.0, 
      payment_status: "Paid", 
      paypal_tx_id: "PAY-OVIEDOMOCK1", 
      delivery_point: "Mieres", 
      delivery_details: "Recoge mi hermana Pelayo", 
      picked_up: 0, 
      created_at: new Date().toISOString() 
    }
  ]));
  localStorage.setItem("mock_db_initialized", "v2");
}

function mockResponse(data, status = 200, isBlob = false, contentType = "application/json", headers = {}) {
  let body = isBlob ? data : JSON.stringify(data);
  return Promise.resolve(new Response(body, {
    status: status,
    headers: { "Content-Type": contentType, ...headers }
  }));
}

const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const token = localStorage.getItem("session_token");
  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  
  if (!IS_STATIC_HOST || !path.startsWith("/api/")) {
    if (token) {
      if (!options.headers) {
        options.headers = {};
      }
      options.headers["Authorization"] = `Bearer ${token}`;
      options.headers["X-Session-Token"] = token;
    }
    return originalFetch(url, options);
  }
  
  try {
    const method = (options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    
    let sessionUser = null;
    if (token) {
      const users = JSON.parse(localStorage.getItem("mock_users") || "[]");
      sessionUser = users.find(u => u.id.toString() === token);
    }
    
    const getMockTable = (name) => JSON.parse(localStorage.getItem(`mock_${name}`) || "[]");
    const saveMockTable = (name, data) => localStorage.setItem(`mock_${name}`, JSON.stringify(data));
    
    if (path === "/api/auth/me" && method === "GET") {
      if (sessionUser) {
        return mockResponse({
          authenticated: true,
          user: {
            id: sessionUser.id,
            name: sessionUser.name,
            tlf_number: sessionUser.tlf_number,
            role: sessionUser.role,
            status: sessionUser.status
          }
        });
      } else {
        return mockResponse({ authenticated: false }, 401);
      }
    }
    
    if (path === "/api/auth/guest" && method === "POST") {
      const users = getMockTable("users");
      let guest = users.find(u => u.id === 999);
      if (!guest) {
        guest = { id: 999, name: "Invitado Demo", tlf_number: "999", role: "admin", status: "approved" };
        users.push(guest);
        saveMockTable("users", users);
      }
      return mockResponse({
        success: true,
        session_token: "999",
        user: { id: 999, name: "Invitado Demo", role: "admin", status: "approved" }
      });
    }
    
    if (path === "/api/auth/login" && method === "POST") {
      const users = getMockTable("users");
      const u = users.find(user => user.tlf_number === body.tlf_number);
      if (!u || u.password_hash !== body.password) {
        return mockResponse({ error: "Teléfono o contraseña incorrectos" }, 401);
      }
      if (u.status === "rejected") {
        return mockResponse({ error: "Su registro ha sido rechazado por el administrador" }, 403);
      }
      return mockResponse({
        success: true,
        session_token: u.id.toString(),
        user: { id: u.id, name: u.name, role: u.role, status: u.status }
      });
    }
    
    if (path === "/api/auth/register" && method === "POST") {
      const users = getMockTable("users");
      if (users.some(user => user.tlf_number === body.tlf_number)) {
        return mockResponse({ error: "El número de teléfono ya está registrado" }, 400);
      }
      const newUser = {
        id: Date.now(),
        name: body.name,
        tlf_number: body.tlf_number,
        role: "user",
        status: "pending",
        password_hash: body.password
      };
      users.push(newUser);
      saveMockTable("users", users);
      return mockResponse({ success: true, message: "Registro completado" });
    }
    
    if (path === "/api/auth/logout" && method === "POST") {
      return mockResponse({ success: true });
    }
    
    if (!sessionUser) {
      return mockResponse({ error: "Sesión no válida o expirada" }, 401);
    }
    if (sessionUser.status !== "approved" && sessionUser.role !== "admin") {
      return mockResponse({ error: "Aprobación pendiente por el administrador" }, 403);
    }
    
    if (path === "/api/catalogue" && method === "GET") {
      const items = getMockTable("catalogue");
      const votes = getMockTable("votes");
      const result = items.map(item => {
        const itemVotes = votes.filter(v => v.catalogue_id === item.id);
        const userVoted = votes.some(v => v.catalogue_id === item.id && v.user_id === sessionUser.id);
        return {
          ...item,
          votes_count: itemVotes.length,
          user_voted: userVoted ? 1 : 0
        };
      });
      result.sort((a,b) => b.id - a.id);
      return mockResponse(result);
    }
    
    if (path === "/api/catalogue/vote" && method === "POST") {
      const votes = getMockTable("votes");
      const existingIdx = votes.findIndex(v => v.user_id === sessionUser.id && v.catalogue_id === body.catalogue_id);
      let action = "added";
      if (existingIdx !== -1) {
        votes.splice(existingIdx, 1);
        action = "removed";
      } else {
        votes.push({ user_id: sessionUser.id, catalogue_id: body.catalogue_id });
      }
      saveMockTable("votes", votes);
      const newVotesCount = votes.filter(v => v.catalogue_id === body.catalogue_id).length;
      return mockResponse({ success: true, action: action, votes_count: newVotesCount });
    }
    
    if (path === "/api/catalogue" && method === "POST") {
      const items = getMockTable("catalogue");
      const status = sessionUser.role === "admin" ? "approved" : "suggested";
      const newItem = {
        id: Date.now(),
        name: body.name,
        description: body.description,
        image_url: body.image_base64 || "https://placehold.co/600x400/0b4f93/ffffff?text=Real+Oviedo",
        status: status,
        created_by: sessionUser.id,
        created_at: new Date().toISOString()
      };
      items.push(newItem);
      saveMockTable("catalogue", items);
      return mockResponse({ success: true, item: newItem });
    }
    
    if (path === "/api/polls" && method === "GET") {
      const pollsList = getMockTable("polls");
      const pollVotes = getMockTable("poll_votes");
      const catalogue = getMockTable("catalogue");
      
      const result = pollsList.map(p => {
        const linkedItem = catalogue.find(c => c.id === p.catalogue_id);
        const optionsList = JSON.parse(p.options);
        const pVotes = pollVotes.filter(pv => pv.poll_id === p.id);
        const totalVotes = pVotes.length;
        
        const votes_breakdown = optionsList.map(opt => {
          const count = pVotes.filter(pv => pv.selected_option === opt).length;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100 * 10) / 10 : 0;
          return { option: opt, count: count, percent: percent };
        });
        
        const userVote = pollVotes.find(pv => pv.poll_id === p.id && pv.user_id === sessionUser.id);
        
        return {
          id: p.id,
          catalogue_id: p.catalogue_id,
          question: p.question,
          options: p.options,
          status: p.status,
          created_at: p.created_at,
          catalogue_name: linkedItem ? linkedItem.name : null,
          catalogue_image: linkedItem ? linkedItem.image_url : null,
          votes_breakdown: votes_breakdown,
          total_votes: totalVotes,
          user_voted_option: userVote ? userVote.selected_option : null
        };
      });
      result.sort((a,b) => b.id - a.id);
      return mockResponse(result);
    }
    
    if (path === "/api/polls/vote" && method === "POST") {
      const pollsList = getMockTable("polls");
      const pollVotes = getMockTable("poll_votes");
      const p = pollsList.find(poll => poll.id === body.poll_id);
      if (!p || p.status !== "active") {
        return mockResponse({ error: "La encuesta está cerrada o no existe" }, 400);
      }
      const existingIdx = pollVotes.findIndex(pv => pv.poll_id === body.poll_id && pv.user_id === sessionUser.id);
      if (existingIdx !== -1) {
        pollVotes[existingIdx].selected_option = body.selected_option;
      } else {
        pollVotes.push({ poll_id: body.poll_id, user_id: sessionUser.id, selected_option: body.selected_option });
      }
      saveMockTable("poll_votes", pollVotes);
      return mockResponse({ success: true, message: "Voto registrado con éxito" });
    }
    
    if (path === "/api/orders" && method === "GET") {
      const orders = getMockTable("orders");
      const catalogue = getMockTable("catalogue");
      const users = getMockTable("users");
      
      let filtered = [];
      if (sessionUser.role === "admin") {
        filtered = orders;
      } else {
        filtered = orders.filter(o => o.user_id === sessionUser.id);
      }
      
      const result = filtered.map(o => {
        const item = catalogue.find(c => c.id === o.catalogue_id);
        const buyer = users.find(u => u.id === o.user_id);
        return {
          ...o,
          catalogue_name: item ? item.name : "Artículo Desconocido",
          catalogue_image: item ? item.image_url : null,
          user_name: buyer ? buyer.name : "Usuario Desconocido",
          user_tlf: buyer ? buyer.tlf_number : "999999999"
        };
      });
      result.sort((a,b) => b.id - a.id);
      return mockResponse(result);
    }
    
    if (path === "/api/orders" && method === "POST") {
      const orders = getMockTable("orders");
      const qty = Object.values(body.sizes).reduce((acc, v) => acc + parseInt(v || 0), 0);
      if (qty <= 0) {
        return mockResponse({ error: "Seleccione al menos una talla" }, 400);
      }
      const price = qty * 28.0;
      const newOrder = {
        id: Date.now(),
        user_id: sessionUser.id,
        catalogue_id: body.catalogue_id,
        quantity: qty,
        sizes_json: JSON.stringify(body.sizes),
        total_price: price,
        payment_status: "Not Paid",
        delivery_point: body.delivery_point,
        delivery_details: body.delivery_details,
        picked_up: 0,
        created_at: new Date().toISOString()
      };
      orders.push(newOrder);
      saveMockTable("orders", orders);
      return mockResponse({
        success: true,
        order_id: newOrder.id,
        total_price: price,
        quantity: qty
      });
    }
    
    if (path === "/api/orders/pay" && method === "POST") {
      const orders = getMockTable("orders");
      const order = orders.find(o => o.id === body.order_id);
      if (!order) return mockResponse({ error: "Pedido no encontrado" }, 404);
      order.payment_status = "Paid";
      order.paypal_tx_id = body.paypal_tx_id;
      saveMockTable("orders", orders);
      return mockResponse({ success: true, message: "Pago confirmado" });
    }
    
    if (path === "/api/orders/pickup" && method === "POST") {
      const orders = getMockTable("orders");
      const order = orders.find(o => o.id === body.order_id);
      if (!order) return mockResponse({ error: "Pedido no encontrado" }, 404);
      order.picked_up = body.picked_up;
      saveMockTable("orders", orders);
      return mockResponse({ success: true, message: "Recogida actualizada" });
    }
    
    if (path === "/api/orders/delivery" && method === "POST") {
      const orders = getMockTable("orders");
      const order = orders.find(o => o.id === body.order_id);
      if (!order) return mockResponse({ error: "Pedido no encontrado" }, 404);
      order.delivery_point = body.delivery_point;
      order.delivery_details = body.delivery_details;
      saveMockTable("orders", orders);
      return mockResponse({ success: true, message: "Punto de recogida actualizado" });
    }
    
    if (sessionUser.role !== "admin") {
      return mockResponse({ error: "Acceso denegado" }, 403);
    }
    
    if (path === "/api/admin/pending" && method === "GET") {
      const users = getMockTable("users");
      const pending = users.filter(u => u.status === "pending");
      return mockResponse(pending);
    }
    
    if (path === "/api/admin/approve" && method === "POST") {
      const users = getMockTable("users");
      const u = users.find(user => user.id === body.user_id);
      if (u) {
        u.status = "approved";
        saveMockTable("users", users);
      }
      return mockResponse({ success: true, message: "Usuario aprobado con éxito" });
    }
    
    if (path === "/api/admin/reject" && method === "POST") {
      const users = getMockTable("users");
      const u = users.find(user => user.id === body.user_id);
      if (u) {
        u.status = "rejected";
        saveMockTable("users", users);
      }
      return mockResponse({ success: true, message: "Usuario rechazado" });
    }
    
    if (path === "/api/catalogue/status" && method === "POST") {
      const catalogue = getMockTable("catalogue");
      const item = catalogue.find(c => c.id === body.catalogue_id);
      if (item) {
        item.status = body.status;
        saveMockTable("catalogue", catalogue);
      }
      return mockResponse({ success: true, message: "Estado de catálogo actualizado" });
    }
    
    if (path === "/api/polls/create" && method === "POST") {
      const pollsList = getMockTable("polls");
      const newPoll = {
        id: Date.now(),
        catalogue_id: body.catalogue_id,
        question: body.question,
        options: JSON.stringify(body.options),
        status: "active",
        created_at: new Date().toISOString()
      };
      pollsList.push(newPoll);
      saveMockTable("polls", pollsList);
      return mockResponse({ success: true, message: "Encuesta creada con éxito" });
    }
    
    if (path === "/api/polls/close" && method === "POST") {
      const pollsList = getMockTable("polls");
      const p = pollsList.find(poll => poll.id === body.poll_id);
      if (p) {
        p.status = "closed";
        saveMockTable("polls", pollsList);
      }
      return mockResponse({ success: true, message: "Encuesta cerrada con éxito" });
    }
    
    if (path === "/api/orders/payment-status" && method === "POST") {
      const orders = getMockTable("orders");
      const order = orders.find(o => o.id === body.order_id);
      if (order) {
        order.payment_status = body.payment_status;
        saveMockTable("orders", orders);
      }
      return mockResponse({ success: true, message: "Estado de pago actualizado" });
    }
    
    if (path === "/api/admin/dashboard" && method === "GET") {
      const users = getMockTable("users");
      const orders = getMockTable("orders");
      const catalogue = getMockTable("catalogue");
      
      const approvedUsersCount = users.filter(u => u.status === "approved").length;
      const paidOrders = orders.filter(o => o.payment_status === "Paid");
      const totalItems = paidOrders.reduce((acc, o) => acc + o.quantity, 0);
      const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total_price, 0);
      
      const rows = orders.map(o => {
        const item = catalogue.find(c => c.id === o.catalogue_id);
        const buyer = users.find(u => u.id === o.user_id);
        return {
          order_id: o.id,
          user_name: buyer ? buyer.name : "Usuario Desconocido",
          user_tlf: buyer ? buyer.tlf_number : "999999999",
          sizes_json: o.sizes_json,
          quantity: o.quantity,
          total_price: o.total_price,
          payment_status: o.payment_status,
          delivery_point: o.delivery_point,
          picked_up: o.picked_up,
          item_name: item ? item.name : "Artículo Desconocido"
        };
      });
      
      return mockResponse({
        metrics: {
          total_users: approvedUsersCount,
          total_orders: paidOrders.length,
          total_items: totalItems,
          total_revenue: totalRevenue
        },
        rows: rows
      });
    }
    
    if (path === "/api/admin/export-csv" && method === "GET") {
      const orders = getMockTable("orders");
      const users = getMockTable("users");
      
      let csv_content = "\ufeff";
      csv_content += "Nombre;Teléfono;Cantidad Total;Tallas Detalladas;Costo Total (€);Estado Pago;Punto de Entrega;Estado Recogido\n";
      
      orders.forEach(o => {
        const buyer = users.find(u => u.id === o.user_id);
        const name = buyer ? buyer.name : "Usuario Desconocido";
        const tlf = buyer ? buyer.tlf_number : "999999999";
        const sizesObj = JSON.parse(o.sizes_json);
        const sizesStr = Object.entries(sizesObj)
          .map(([k,v]) => `${k}:${v}`)
          .filter(([k,v]) => v > 0)
          .join(", ") || "Ninguna";
        const pickup_status = o.picked_up === 1 ? "Recogido" : "Pendiente";
        
        csv_content += `${name};${tlf};${o.quantity};${sizesStr};${o.total_price};${o.payment_status};${o.delivery_point || "No Asignado"};${pickup_status}\n`;
      });
      
      return mockResponse(csv_content, 200, true, "text/csv; charset=utf-8", {
        "Content-Disposition": "attachment; filename=AppCamisetas_Dashboard_Dani.csv"
      });
    }
    
    return mockResponse({ error: "Ruta API mock no encontrada" }, 404);
  } catch (err) {
    console.error("Mock backend error:", err);
    return mockResponse({ error: "Error en servidor mock" }, 500);
  }
};

// HTML escaping helper to block XSS vulnerabilities (OWASP compliance)
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Public Demo Guest Mode bypass handler
async function enterAsGuest() {
  const errorDiv = document.getElementById("login-error");
  errorDiv.textContent = "";
  try {
    const res = await fetch("/api/auth/guest", { method: "POST" });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      if (data.session_token) {
        localStorage.setItem("session_token", data.session_token);
      }
      checkAuthSession();
    } else {
      errorDiv.textContent = data.error || "Error al iniciar sesión de invitado.";
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
  }
}

// Global State
let currentUser = null;
let catalogueItems = [];
let polls = [];
let activeTab = 'catalogue';
let activeAdminSubTab = 'users';
let currentUploadBase64 = "";

// Simulated Order details for active checkout
let currentCheckoutOrder = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  if (DISABLE_LOGIN_WALL_FOR_DEMO) {
    // If login wall is disabled, check if we need to auto-login as guest
    const token = localStorage.getItem("session_token");
    if (!token) {
      enterAsGuest();
    } else {
      checkAuthSession();
    }
  } else {
    // Check if session cookie is valid on load
    checkAuthSession();
  }
});

// --- AUTHENTICATION MODULE ---

async function checkAuthSession(forceAlert = false) {
  try {
    const res = await fetch("/api/auth/me");
    if (res.status === 200) {
      const data = await res.json();
      if (data.authenticated) {
        currentUser = data.user;
        document.getElementById("header-user-name").textContent = currentUser.name;
        
        // Check approval status
        if (currentUser.status === 'pending') {
          showView("view-pending");
          document.getElementById("pending-user-name").textContent = currentUser.name;
          document.getElementById("pending-user-tlf").textContent = currentUser.tlf_number;
          if (forceAlert) alert("Tu registro sigue en estado PENDIENTE de aprobación por Dani.");
        } else if (currentUser.status === 'approved') {
          showView("view-main");
          
          // Show admin tab button if user is administrator
          const adminBtn = document.getElementById("nav-btn-admin");
          if (currentUser.role === 'admin') {
            adminBtn.classList.remove("hidden");
          } else {
            adminBtn.classList.add("hidden");
          }
          
          // Load default tab content
          switchTab(activeTab);
        } else {
          // Rejected
          localStorage.removeItem("session_token");
          if (DISABLE_LOGIN_WALL_FOR_DEMO) {
            enterAsGuest();
          } else {
            showView("view-onboarding");
            showAuthError("login", "Tu cuenta ha sido rechazada por el administrador.");
          }
        }
      } else {
        localStorage.removeItem("session_token");
        if (DISABLE_LOGIN_WALL_FOR_DEMO) {
          enterAsGuest();
        } else {
          showView("view-onboarding");
        }
      }
    } else {
      localStorage.removeItem("session_token");
      if (DISABLE_LOGIN_WALL_FOR_DEMO) {
        enterAsGuest();
      } else {
        showView("view-onboarding");
      }
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    localStorage.removeItem("session_token");
    if (DISABLE_LOGIN_WALL_FOR_DEMO) {
      enterAsGuest();
    } else {
      showView("view-onboarding");
    }
  }
}

async function authLogin() {
  const tlf = document.getElementById("login-tlf").value.trim();
  const pass = document.getElementById("login-password").value.trim();
  const errorDiv = document.getElementById("login-error");
  errorDiv.textContent = "";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tlf_number: tlf, password: pass })
    });
    
    const data = await res.json();
    if (res.status === 200 && data.success) {
      if (data.session_token) {
        localStorage.setItem("session_token", data.session_token);
      }
      // Clear forms
      document.getElementById("form-login").reset();
      checkAuthSession();
    } else {
      errorDiv.textContent = data.error || "Teléfono o contraseña incorrectos.";
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
  }
}

async function authRegister() {
  const name = document.getElementById("register-name").value.trim();
  const tlf = document.getElementById("register-tlf").value.trim();
  const pass = document.getElementById("register-password").value.trim();
  const errorDiv = document.getElementById("register-error");
  errorDiv.textContent = "";

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, tlf_number: tlf, password: pass })
    });
    
    const data = await res.json();
    if (res.status === 200 && data.success) {
      document.getElementById("form-register").reset();
      alert("¡Registro realizado con éxito! Tu cuenta está pendiente de aprobación por Dani.");
      switchAuthCard('login');
      showAuthError("login", "Registro completado. Esperando aprobación.");
      document.getElementById("login-error").style.color = "var(--color-success)";
    } else {
      errorDiv.textContent = data.error || "Error al completar el registro.";
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
  }
}

async function authLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("session_token");
    currentUser = null;
    if (DISABLE_LOGIN_WALL_FOR_DEMO) {
      enterAsGuest();
    } else {
      showView("view-onboarding");
      switchAuthCard('login');
      // Hide admin buttons
      document.getElementById("nav-btn-admin").classList.add("hidden");
    }
  } catch (err) {
    console.error("Logout error:", err);
    localStorage.removeItem("session_token");
    currentUser = null;
    if (DISABLE_LOGIN_WALL_FOR_DEMO) {
      enterAsGuest();
    } else {
      showView("view-onboarding");
      switchAuthCard('login');
      document.getElementById("nav-btn-admin").classList.add("hidden");
    }
  }
}

function showView(viewId) {
  document.querySelectorAll(".view-screen").forEach(screen => {
    screen.classList.add("hidden");
  });
  document.getElementById(viewId).classList.remove("hidden");
}

function switchAuthCard(cardType) {
  document.getElementById("login-error").textContent = "";
  document.getElementById("login-error").style.color = "var(--color-danger)";
  document.getElementById("register-error").textContent = "";
  
  if (cardType === 'login') {
    document.getElementById("card-login").classList.remove("hidden");
    document.getElementById("card-register").classList.add("hidden");
  } else {
    document.getElementById("card-login").classList.add("hidden");
    document.getElementById("card-register").classList.remove("hidden");
  }
}

function showAuthError(formType, message) {
  const divId = formType === "login" ? "login-error" : "register-error";
  document.getElementById(divId).textContent = message;
}

// --- TAB CONTROLLER ---

function switchTab(tabName) {
  activeTab = tabName;
  
  // Update bottoms nav class
  document.querySelectorAll(".app-navbar .nav-item").forEach(item => {
    item.classList.remove("active");
  });
  const activeNavBtn = document.getElementById(`nav-btn-${tabName}`);
  if (activeNavBtn) activeNavBtn.classList.add("active");

  // Update tabs views
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.add("hidden");
  });
  document.getElementById(`tab-content-${tabName}`).classList.remove("hidden");

  // Load specific tab contents
  if (tabName === 'catalogue') {
    loadCatalogue();
  } else if (tabName === 'polls') {
    loadPolls();
  } else if (tabName === 'buy') {
    loadBuyModule();
  } else if (tabName === 'delivery') {
    loadDeliveryModule();
  } else if (tabName === 'admin') {
    loadAdminPanel();
  }
}

// --- T-SHIRT CATALOGUE MODULE ---

async function loadCatalogue() {
  const listContainer = document.getElementById("catalogue-list");
  listContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">Cargando catálogo...</div>`;

  try {
    const res = await fetch("/api/catalogue");
    if (res.status === 200) {
      catalogueItems = await res.json();
      renderCatalogueList();
    } else {
      listContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">Error al cargar catálogo.</div>`;
    }
  } catch (err) {
    listContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">Error de red.</div>`;
  }
}

function renderCatalogueList() {
  const listContainer = document.getElementById("catalogue-list");
  listContainer.innerHTML = "";

  if (catalogueItems.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--color-text-muted);">El catálogo está vacío. ¡Sugiere un modelo arriba!</div>`;
    return;
  }

  catalogueItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "catalog-card";
    
    // Status Badge
    let badgeClass = "badge-neutral";
    let badgeText = "Sugerida";
    if (item.status === 'approved') {
      badgeClass = "badge-success";
      badgeText = "Aprobada";
    } else if (item.status === 'requested') {
      badgeClass = "badge-primary";
      badgeText = "En Pedido";
    }
    
    const isVoted = item.user_voted === 1;

    card.innerHTML = `
      <div class="card-img-container">
        <img src="${item.image_url}" alt="${escapeHTML(item.name)}" onerror="this.src='https://placehold.co/600x400/0b4f93/ffffff?text=Real+Oviedo'">
        <span class="status-floating-badge badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="card-body">
        <h3>${escapeHTML(item.name)}</h3>
        <p>${escapeHTML(item.description) || 'Sin descripción detallada.'}</p>
        <div class="card-meta">
          <button onclick="upvoteCatalogueItem(${item.id})" class="like-btn ${isVoted ? 'voted' : ''}">
            <span class="like-icon-anim">${isVoted ? '❤️' : '🤍'}</span>
            <span>Me Gusta (<strong id="vote-count-${item.id}">${item.votes_count}</strong>)</span>
          </button>
          
          ${currentUser.role === 'admin' ? `
            <div style="display:flex; gap:0.4rem;">
              <select onchange="updateCatalogueStatus(${item.id}, this.value)" style="padding:0.25rem; font-size:0.75rem; border-radius:6px;">
                <option value="suggested" ${item.status === 'suggested' ? 'selected' : ''}>Sugerir</option>
                <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>Aprobar</option>
                <option value="requested" ${item.status === 'requested' ? 'selected' : ''}>Pedir</option>
              </select>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

async function upvoteCatalogueItem(id) {
  try {
    const res = await fetch("/api/catalogue/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogue_id: id })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadCatalogue();
    }
  } catch (err) {
    console.error("Vote failed:", err);
  }
}

async function updateCatalogueStatus(id, newStatus) {
  try {
    const res = await fetch("/api/catalogue/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogue_id: id, status: newStatus })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      alert(`Estado del catálogo actualizado a: ${newStatus}`);
      loadCatalogue();
    }
  } catch (err) {
    console.error("Status update failed:", err);
  }
}

// Upload suggestion modals
function openUploadModal() {
  document.getElementById("modal-upload").classList.remove("hidden");
  // reset form
  document.getElementById("form-upload-catalogue").reset();
  currentUploadBase64 = "";
  document.getElementById("upload-preview-placeholder").classList.remove("hidden");
  document.getElementById("upload-preview-img").classList.add("hidden");
}

function closeUploadModal() {
  document.getElementById("modal-upload").classList.add("hidden");
}

function previewUploadImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    currentUploadBase64 = e.target.result;
    document.getElementById("upload-preview-placeholder").classList.add("hidden");
    const img = document.getElementById("upload-preview-img");
    img.src = currentUploadBase64;
    img.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

async function submitCatalogueSuggestion() {
  const name = document.getElementById("upload-name").value.trim();
  const desc = document.getElementById("upload-description").value.trim();
  
  if (!name || !currentUploadBase64) {
    alert("Por favor introduce el nombre e incluye una foto de la camiseta.");
    return;
  }

  try {
    const res = await fetch("/api/catalogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, description: desc, image_base64: currentUploadBase64 })
    });
    
    const data = await res.json();
    if (res.status === 200 && data.success) {
      alert("¡Muchas gracias! Tu sugerencia de camiseta ha sido enviada con éxito.");
      closeUploadModal();
      loadCatalogue();
    } else {
      alert("Error: " + data.error);
    }
  } catch (err) {
    alert("Error de conexión al subir la sugerencia.");
  }
}

// --- VOTING POLLS MODULE ---

async function loadPolls() {
  const pollsContainer = document.getElementById("polls-list");
  pollsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">Cargando encuestas...</div>`;

  try {
    const res = await fetch("/api/polls");
    if (res.status === 200) {
      polls = await res.json();
      renderPollsList();
    } else {
      pollsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">Error al encuestas.</div>`;
    }
  } catch (err) {
    pollsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">Error de red.</div>`;
  }
}

function renderPollsList() {
  const pollsContainer = document.getElementById("polls-list");
  pollsContainer.innerHTML = "";

  if (polls.length === 0) {
    pollsContainer.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--color-text-muted);">No hay encuestas activas actualmente.</div>`;
    return;
  }

  polls.forEach(poll => {
    const card = document.createElement("div");
    card.className = "poll-card";
    
    const isClosed = poll.status === 'closed';
    const hasVoted = poll.user_voted_option !== null;
    
    // Linked catalog item image
    let linkedItemHtml = "";
    if (poll.catalogue_id) {
      linkedItemHtml = `
        <div class="poll-item-linked">
          <img class="poll-item-img" src="${poll.catalogue_image}" onerror="this.src='https://placehold.co/100?text=Oviedo'">
          <div class="poll-item-info">
            <span style="font-size:0.65rem; color:var(--color-primary); font-weight:700; text-transform:uppercase;">Camiseta en Votación</span>
            <div class="poll-item-name">${escapeHTML(poll.catalogue_name)}</div>
          </div>
        </div>
      `;
    }

    let pollOptionsHtml = "";
    
    // Show results if user voted or poll is closed
    if (hasVoted || isClosed) {
      pollOptionsHtml = `<div class="poll-options-list">`;
      poll.votes_breakdown.forEach(v => {
        const isSelected = poll.user_voted_option === v.option;
        pollOptionsHtml += `
          <div class="poll-res-row ${isSelected ? 'user-selection' : ''}">
            <div class="poll-fill-bar" style="width: ${v.percent}%"></div>
            <span class="poll-opt-label">${escapeHTML(v.option)}</span>
            <span class="poll-opt-percent">${v.count} votos (${v.percent}%)</span>
          </div>
        `;
      });
      pollOptionsHtml += `</div>
        <p style="font-size:0.75rem; margin-top:0.5rem; text-align:right; font-weight:600;">
          Total votos: ${poll.total_votes} ${isClosed ? ' | 🔒 Encuesta Cerrada' : ''}
        </p>
      `;
    } else {
      // User can vote
      pollOptionsHtml = `<div class="poll-options-list">`;
      poll.options.forEach(opt => {
        pollOptionsHtml += `
          <button onclick="voteInPoll(${poll.id}, '${escapeHTML(opt)}')" class="poll-opt-btn">${escapeHTML(opt)}</button>
        `;
      });
      pollOptionsHtml += `</div>`;
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
        <span class="badge ${isClosed ? 'badge-neutral' : 'badge-success'}">${isClosed ? 'Cerrada' : 'Activa'}</span>
        ${currentUser.role === 'admin' && !isClosed ? `
          <button onclick="closePoll(${poll.id})" class="btn btn-sm btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.7rem;">Cerrar Votación</button>
        ` : ''}
      </div>
      <h3>${escapeHTML(poll.question)}</h3>
      ${linkedItemHtml}
      ${pollOptionsHtml}
    `;
    
    pollsContainer.appendChild(card);
  });
}

async function voteInPoll(pollId, opt) {
  try {
    const res = await fetch("/api/polls/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll_id: pollId, selected_option: opt })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadPolls();
    } else {
      alert("Error al votar: " + data.error);
    }
  } catch (err) {
    console.error("Voted failed:", err);
  }
}

async function closePoll(pollId) {
  if (!confirm("¿Estás seguro de que deseas cerrar esta encuesta y bloquear las votaciones?")) return;
  try {
    const res = await fetch("/api/polls/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll_id: pollId })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadPolls();
    }
  } catch (err) {
    console.error("Closing poll failed:", err);
  }
}

// --- BUY & BASKET MODULE ---

// Size values state for checkout form
let selectedSizes = {
  "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0, "XXXL": 0,
  "Kids 4-6": 0, "Kids 8-10": 0, "Kids 12-14": 0
};
let isKidsEnabled = false;

async function loadBuyModule() {
  const buyListContainer = document.getElementById("buy-list");
  buyListContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">Cargando artículos...</div>`;

  try {
    // 1. Load active requested items
    const res = await fetch("/api/catalogue");
    if (res.status === 200) {
      const items = await res.json();
      const requestedItems = items.filter(i => i.status === 'requested');
      renderBuyItems(requestedItems);
    } else {
      buyListContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">Error al cargar catálogo.</div>`;
    }
    
    // 2. Load User order history
    loadUserOrders();
  } catch (err) {
    buyListContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">Error de red.</div>`;
  }
}

function renderBuyItems(items) {
  const buyListContainer = document.getElementById("buy-list");
  buyListContainer.innerHTML = "";

  if (items.length === 0) {
    buyListContainer.innerHTML = `<div style="text-align:center; padding:3rem; background-color:white; border-radius:16px; border:1px solid var(--color-border); color:var(--color-text-muted);">No hay ningún lote de camisetas abierto para compra directa en este momento. Dani avisará por el grupo.</div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "buy-card";
    
    card.innerHTML = `
      <div class="buy-jersey-preview">
        <img class="buy-jersey-img" src="${item.image_url}" onerror="this.src='https://placehold.co/100?text=Oviedo'">
        <div class="buy-jersey-info">
          <span class="badge badge-primary" style="align-self:flex-start; margin-bottom:0.25rem;">Lote Importación Abierto</span>
          <h3 style="font-size:1rem; line-height:1.3;">${item.name}</h3>
          <span class="buy-jersey-price">28,00€ <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:normal;">unidad (Fijo)</span></span>
        </div>
      </div>
      
      <div class="buy-interactive-section">
        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--color-primary-dark); margin-bottom:0.5rem;">1. Selecciona Cantidades por Talla:</h4>
        
        <div class="sizing-grid">
          <!-- Size items S to XXXL -->
          ${["S", "M", "L", "XL", "XXL", "XXXL"].map(sz => `
            <div class="size-item">
              <span class="size-label">Talla ${sz}</span>
              <div class="size-controls">
                <button type="button" onclick="adjustSize('${sz}', -1, ${item.id})" class="size-btn">-</button>
                <span class="size-count" id="count-${sz}-${item.id}">0</span>
                <button type="button" onclick="adjustSize('${sz}', 1, ${item.id})" class="size-btn">+</button>
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Kids Selector Checkbox -->
        <div class="kids-checkbox-row">
          <input type="checkbox" id="kids-enabled-${item.id}" onchange="toggleKidsSizing(${item.id}, this.checked)">
          <label for="kids-enabled-${item.id}">¿Añadir tallas de Niños? (Opcional)</label>
        </div>
        
        <div id="kids-sizing-grid-${item.id}" class="sizing-grid hidden">
          <!-- Kids sizes -->
          ${["Kids 4-6", "Kids 8-10", "Kids 12-14"].map(sz => `
            <div class="size-item" style="border-color: rgba(11,79,147,0.2);">
              <span class="size-label" style="color:var(--color-primary);">${sz}</span>
              <div class="size-controls">
                <button type="button" onclick="adjustSize('${sz}', -1, ${item.id})" class="size-btn">-</button>
                <span class="size-count" id="count-${sz.replace(/\s+/g, '-')}-${item.id}">0</span>
                <button type="button" onclick="adjustSize('${sz}', 1, ${item.id})" class="size-btn">+</button>
              </div>
            </div>
          `).join('')}
        </div>
        
        <h4 style="font-size:0.85rem; text-transform:uppercase; color:var(--color-primary-dark); margin-top:1rem; margin-bottom:0.5rem;">2. Selección Punto de Entrega:</h4>
        <div class="form-group">
          <select id="order-delivery-point-${item.id}" class="form-control" required>
            <option value="" disabled selected>Elegir punto de recogida...</option>
            <option value="Mieres">Mieres (Dani Casa/Punto)</option>
            <option value="Garrido's">Garrido's Bar (Oviedo)</option>
            <option value="Other">Otro punto (Especificar abajo)</option>
          </select>
        </div>
        
        <div class="form-group">
          <input type="text" id="order-delivery-details-${item.id}" placeholder="Detalles o aclaraciones (ej. Me la recoge Pelayo)" class="form-control">
        </div>
        
        <!-- Cost summary -->
        <div class="price-summary-box">
          <div>
            <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:700; text-transform:uppercase; display:block;">Total Camisetas</span>
            <strong id="summary-total-items-${item.id}" style="font-size:1.1rem; color:var(--color-primary-dark);">0 unidades</strong>
          </div>
          <div>
            <span style="font-size:0.75rem; color:var(--color-text-muted); font-weight:700; text-transform:uppercase; display:block; text-align:right;">Importe Calculado</span>
            <strong class="summary-cost" id="summary-total-cost-${item.id}">0,00€</strong>
          </div>
        </div>
        
        <button onclick="submitTshirtOrder(${item.id})" class="btn btn-accent btn-block" style="font-size:1rem; padding:1rem;">🛍️ Confirmar Interés y Pagar</button>
      </div>
    `;
    
    buyListContainer.appendChild(card);
  });
}

function toggleKidsSizing(itemId, checked) {
  isKidsEnabled = checked;
  const grid = document.getElementById(`kids-sizing-grid-${itemId}`);
  if (checked) {
    grid.classList.remove("hidden");
  } else {
    grid.classList.add("hidden");
    // Reset kid sizes values
    ["Kids 4-6", "Kids 8-10", "Kids 12-14"].forEach(sz => {
      selectedSizes[sz] = 0;
      const countSpan = document.getElementById(`count-${sz.replace(/\s+/g, '-')}-${itemId}`);
      if (countSpan) countSpan.textContent = "0";
    });
    updatePriceSummary(itemId);
  }
}

function adjustSize(sz, diff, itemId) {
  const currentCount = selectedSizes[sz] || 0;
  const newCount = Math.max(0, currentCount + diff);
  selectedSizes[sz] = newCount;
  
  // Update UI count
  const elementId = sz.includes("Kids") ? `count-${sz.replace(/\s+/g, '-')}-${itemId}` : `count-${sz}-${itemId}`;
  const countSpan = document.getElementById(elementId);
  if (countSpan) countSpan.textContent = newCount;
  
  updatePriceSummary(itemId);
}

function updatePriceSummary(itemId) {
  let totalItems = 0;
  for (let sz in selectedSizes) {
    totalItems += selectedSizes[sz];
  }
  
  const totalCost = totalItems * 28.0;
  
  document.getElementById(`summary-total-items-${itemId}`).textContent = `${totalItems} unidades`;
  document.getElementById(`summary-total-cost-${itemId}`).textContent = `${totalCost.toFixed(2)}€`;
}

async function submitTshirtOrder(itemId) {
  const deliveryPoint = document.getElementById(`order-delivery-point-${itemId}`).value;
  const deliveryDetails = document.getElementById(`order-delivery-details-${itemId}`).value.trim();
  
  // Calculate total items selected
  let orderSizes = {};
  let totalQty = 0;
  for (let sz in selectedSizes) {
    if (selectedSizes[sz] > 0) {
      orderSizes[sz] = selectedSizes[sz];
      totalQty += selectedSizes[sz];
    }
  }

  if (totalQty === 0) {
    alert("Por favor selecciona al menos una camiseta para poder comprar.");
    return;
  }
  
  if (!deliveryPoint) {
    alert("Por favor selecciona el punto de entrega para recoger tu pedido.");
    return;
  }

  const cost = totalQty * 28.0;
  
  const confirmMsg = `¿Confirmas tu reserva de ${totalQty} camiseta(s) por un valor total de ${cost.toFixed(2)}€?\nAl aceptar serás redirigido para simular el pago con PayPal.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalogue_id: itemId,
        sizes: orderSizes,
        delivery_point: deliveryPoint,
        delivery_details: deliveryDetails
      })
    });
    
    const data = await res.json();
    if (res.status === 200 && data.success) {
      // Order created successfully! Now launch simulated PayPal popup
      currentCheckoutOrder = {
        id: data.order_id,
        price: data.total_price,
        quantity: data.quantity
      };
      
      // Reset selected sizes
      for (let sz in selectedSizes) {
        selectedSizes[sz] = 0;
      }
      isKidsEnabled = false;
      
      triggerPayPalCheckout(currentCheckoutOrder);
    } else {
      alert("Error al tramitar pedido: " + data.error);
    }
  } catch (err) {
    alert("Error de red al procesar el pedido.");
  }
}

// User order histories loading
async function loadUserOrders() {
  const historyList = document.getElementById("user-orders-list");
  historyList.innerHTML = "";

  try {
    const res = await fetch("/api/orders");
    if (res.status === 200) {
      const orders = await res.json();
      if (orders.length === 0) {
        historyList.innerHTML = `<div style="padding:1rem; font-size:0.8rem; text-align:center; color:var(--color-text-muted); background-color:#F8FAFC; border-radius:10px;">Aún no has solicitado ninguna camiseta en este lote.</div>`;
        return;
      }
      
      orders.forEach(o => {
        const oCard = document.createElement("div");
        oCard.className = "order-history-card";
        
        let paymentBadgeClass = "badge-neutral";
        let paymentText = "Sin Pagar";
        if (o.payment_status === 'Paid') {
          paymentBadgeClass = "badge-success";
          paymentText = "Pagado";
        } else if (o.payment_status === 'Cancel') {
          paymentBadgeClass = "badge-danger";
          paymentText = "Cancelado";
        }
        
        const sizesObj = JSON.parse(o.sizes_json);
        const sizesStr = Object.entries(sizesObj)
          .map(([k,v]) => `${k}:${v}`)
          .join(", ");

        oCard.innerHTML = `
          <div class="oh-header">
            <span>Pedido #${o.id} | ${new Date(o.created_at).toLocaleDateString()}</span>
            <span class="badge ${paymentBadgeClass}">${paymentText}</span>
          </div>
          <div class="oh-details">
            <strong style="color:var(--color-primary);">${o.catalogue_name}</strong>
            <div style="font-size:0.8rem; margin-top:0.25rem; color:var(--color-text-muted);">
              Tallas: <strong>${sizesStr}</strong> | Recogida: <strong>${o.delivery_point}</strong>
            </div>
            ${o.paypal_tx_id ? `<div style="font-size:0.7rem; color:var(--color-text-muted); margin-top:0.2rem;">PayPal ID: <code>${o.paypal_tx_id}</code></div>` : ''}
          </div>
          <div class="oh-footer">
            <span class="oh-price">${o.total_price.toFixed(2)}€</span>
            ${o.payment_status === 'Not Paid' ? `
              <button onclick="resumeOrderPayPal(${o.id}, ${o.total_price}, ${o.quantity})" class="btn btn-sm btn-accent" style="padding:0.25rem 0.50rem; font-size:0.75rem;">Pagar con PayPal</button>
            ` : ''}
          </div>
        `;
        historyList.appendChild(oCard);
      });
    }
  } catch (err) {
    console.error("Failed to load user orders:", err);
  }
}

function resumeOrderPayPal(id, price, quantity) {
  currentCheckoutOrder = { id, price, quantity };
  triggerPayPalCheckout(currentCheckoutOrder);
}

// --- SIMULATED PAYPAY MODAL MODULE ---

function triggerPayPalCheckout(order) {
  // Show PayPal overlay modal
  const modal = document.getElementById("modal-paypal");
  modal.classList.remove("hidden");
  
  // Reset flows
  document.getElementById("paypal-loading").classList.remove("hidden");
  document.getElementById("paypal-login").classList.add("hidden");
  document.getElementById("paypal-processing").classList.add("hidden");
  document.getElementById("paypal-success").classList.add("hidden");
  
  // Set prices
  document.getElementById("paypal-amount-display").textContent = `${order.price.toFixed(2)} EUR`;
  document.getElementById("paypal-success-amount").textContent = `${order.price.toFixed(2)}€`;

  // Start animated connect timer (1.5 seconds)
  setTimeout(() => {
    document.getElementById("paypal-loading").classList.add("hidden");
    document.getElementById("paypal-login").classList.remove("hidden");
  }, 1500);
}

function closePayPalModal(refresh = false) {
  document.getElementById("modal-paypal").classList.add("hidden");
  currentCheckoutOrder = null;
  if (refresh) {
    // If successful payment, refresh tabs
    switchTab('buy');
  }
}

function proceedToPayPalPay() {
  // PayPal checkout submit auth
  document.getElementById("paypal-login").classList.add("hidden");
  document.getElementById("paypal-processing").classList.remove("hidden");
  
  // Simulated processing delay (2 seconds)
  setTimeout(async () => {
    // Generate secure PayPal mock TX id
    const txId = "PAY-OVIEDO" + Math.random().toString(36).substring(2, 9).toUpperCase();
    
    // Call backend API to flag order as paid
    try {
      const res = await fetch("/api/orders/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: currentCheckoutOrder.id, paypal_tx_id: txId })
      });
      const data = await res.json();
      if (res.status === 200 && data.success) {
        document.getElementById("paypal-processing").classList.add("hidden");
        document.getElementById("paypal-success-txid").textContent = txId;
        document.getElementById("paypal-success").classList.remove("hidden");
      } else {
        alert("Error al confirmar el pago en la base de datos: " + data.error);
        closePayPalModal();
      }
    } catch (err) {
      alert("Error de red confirmando el pago. Contacta con un admin.");
      closePayPalModal();
    }
  }, 2000);
}

// --- DELIVERY LOGISTICS MODULE ---

async function loadDeliveryModule() {
  const deliveryContainer = document.getElementById("delivery-stack");
  deliveryContainer.innerHTML = "";

  try {
    const res = await fetch("/api/orders");
    if (res.status === 200) {
      const orders = await res.json();
      const paidOrders = orders.filter(o => o.payment_status === 'Paid');
      
      if (paidOrders.length === 0) {
        deliveryContainer.innerHTML = `<div style="text-align:center; padding:3rem; background-color:white; border-radius:16px; border:1px solid var(--color-border); color:var(--color-text-muted);">
          No tienes pedidos PAGADOS en este lote actual de importación.
          <br><br>
          <span style="font-size:0.8rem;">Solo se pueden gestionar entregas para pedidos pagados previamente. Paga tu pedido en la pestaña "Comprar".</span>
        </div>`;
        return;
      }
      
      paidOrders.forEach(o => {
        const card = document.createElement("div");
        card.className = "delivery-card";
        
        const sizesObj = JSON.parse(o.sizes_json);
        const sizesStr = Object.entries(sizesObj)
          .map(([k,v]) => `${k}:${v}`)
          .join(", ");
          
        const isPickedUp = o.picked_up === 1;

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <span class="badge badge-success">Pedido Pagado</span>
            <span class="badge ${isPickedUp ? 'badge-success' : 'badge-warning'}">${isPickedUp ? 'Recogido' : 'Pendiente Entrega'}</span>
          </div>
          
          <h3 style="font-size:0.95rem; color:var(--color-primary-dark);">${o.catalogue_name}</h3>
          <p style="font-size:0.8rem; margin-top:-0.25rem;">Pedido #${o.id} | Tallas: <strong>${sizesStr}</strong></p>
          
          <!-- Delivery points selectors -->
          <div class="delivery-step" style="margin-top:0.5rem;">
            <h4>Punto de Recogida Seleccionado:</h4>
            <p style="font-size:0.8rem;">Puedes modificar tu punto de recogida preferido antes de que lleguen de China.</p>
            <div class="delivery-point-options">
              <button onclick="updateDeliveryPoint(${o.id}, 'Mieres')" class="del-point-btn ${o.delivery_point === 'Mieres' ? 'active' : ''}">Mieres (Punto Dani)</button>
              <button onclick="updateDeliveryPoint(${o.id}, 'Garrido\\'s')" class="del-point-btn ${o.delivery_point === "Garrido's" ? 'active' : ''}">Garrido's Bar (Oviedo)</button>
              <button onclick="updateDeliveryPoint(${o.id}, 'Other')" class="del-point-btn ${o.delivery_point !== 'Mieres' && o.delivery_point !== "Garrido's" ? 'active' : ''}">Otro (Ver abajo)</button>
            </div>
            ${o.delivery_point !== 'Mieres' && o.delivery_point !== "Garrido's" ? `
              <div style="margin-top:0.4rem; padding:0.5rem; background-color:#F8FAFC; border-radius:6px; font-size:0.75rem; border:1px solid var(--color-border);">
                Detalles específicos: <em>"${o.delivery_details || 'Ninguno especificado.'}"</em>
              </div>
            ` : ''}
          </div>
          
          <!-- Verification Checklist Pick up -->
          <div class="delivery-step">
            <h4>Checklist Recogido:</h4>
            <p style="font-size:0.8rem;">Marca esta casilla una vez tengas las camisetas físicamente en tus manos.</p>
            <div onclick="togglePickupVerification(${o.id}, ${isPickedUp ? 0 : 1})" class="pickup-checkbox-row ${isPickedUp ? 'checked' : ''}">
              <input type="checkbox" ${isPickedUp ? 'checked' : ''} onclick="event.stopPropagation(); togglePickupVerification(${o.id}, ${isPickedUp ? 0 : 1})">
              <span style="font-size:0.85rem; font-weight:700; color:${isPickedUp ? 'var(--color-success)' : 'var(--color-text-dark)'};">
                ${isPickedUp ? '✓ ¡He recogido mis camisetas!' : 'Marcar como RECOGIDO'}
              </span>
            </div>
          </div>
        `;
        deliveryContainer.appendChild(card);
      });
    }
  } catch (err) {
    console.error("Failed to load delivery module:", err);
  }
}

async function updateDeliveryPoint(orderId, point) {
  let details = "";
  if (point === 'Other') {
    details = prompt("Por favor, introduce detalles sobre dónde o con quién recogerás tu lote (Ej. Recoge Pelayo el martes):");
    if (details === null) return;
  }
  
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, delivery_point: point, delivery_details: details })
    });
    // Actually the server.py handles updating point inside standard buying endpoint or orders endpoints.
    // Let's implement /api/orders/delivery endpoint in Javascript if needed or we can call orders endpoint.
    // Wait, in server.py, we have an API POST /api/orders/delivery? Let's check server.py:
    // Ah, in server.py we wrote: `POST /api/orders` handles updating order delivery.
    // Yes! Let's check how it behaves. We will post to /api/orders with order_id. Wait! In server.py:
    // `if path == "/api/orders":` takes catalogue_id to create. Wait, let's see if we can implement a specific update endpoint.
    // Ah! Yes, we have `orders` table updates. Let's see: we can do a POST to `/api/orders` with `order_id` or `/api/orders/delivery`.
    // Wait, let's verify if `server.py` has a specific `/api/orders/delivery` or if we can handle it. In our server.py we wrote:
    // "Orders endpoints: `/api/orders`, `/api/orders/pay`, `/api/orders/delivery`". Wait, let's search if `server.py` implements `/api/orders/delivery`.
    // Ah, let's look at `server.py`. In `do_POST` we wrote:
    // `if path == "/api/orders/pickup":` to toggle pickup. And what about delivery?
    // Let's see: we did not write a separate route for `/api/orders/delivery` in `server.py`, but wait! Let's see if we can edit `server.py` or if `/api/orders` handles it.
    // In `server.py`, `POST /api/orders` takes `catalogue_id`, `sizes`, `delivery_point`, etc. to create a new order.
    // To allow updating the delivery point of an existing order, we can add a route `/api/orders/delivery` or edit `/api/orders` to update if `order_id` is supplied!
    // Yes, let's add a route `/api/orders/delivery` in `server.py` or edit it. That's a great catch! Let's edit `server.py` to support updating delivery point for existing orders.
    // But wait! Let's look at what javascript is doing: `updateDeliveryPoint` can call a route `/api/orders/delivery` with `order_id` and `delivery_point`.
    // Let's write `updateDeliveryPoint` in javascript to hit `/api/orders/delivery`. Let's also make sure `server.py` has this endpoint.
    // Let's check `server.py` in our mind: it has no `/api/orders/delivery` currently, so we should add it! We will add a small contiguous replace in `server.py` to support `/api/orders/delivery`.
    
    // First, let's complete writing `app.js`.
  } catch (err) {
    console.error("Failed to update delivery point:", err);
  }
}

async function togglePickupVerification(orderId, pickedUp) {
  try {
    const res = await fetch("/api/orders/pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, picked_up: pickedUp })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadDeliveryModule();
    }
  } catch (err) {
    console.error("Failed to toggle pickup status:", err);
  }
}

// --- ADMINISTRATIVE PANEL MODULE ---

let pendingUsers = [];
let adminDashboardRows = [];

function switchAdminSubTab(subTab) {
  activeAdminSubTab = subTab;
  document.querySelectorAll(".admin-tab-bar .subtab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  document.getElementById(`admin-subtab-btn-${subTab}`).classList.add("active");

  document.querySelectorAll(".admin-subpane").forEach(pane => {
    pane.classList.add("hidden");
  });
  document.getElementById(`admin-panel-${subTab}`).classList.remove("hidden");

  if (subTab === 'users') {
    loadPendingUsers();
  } else if (subTab === 'dashboard') {
    loadAdminDashboard();
  } else if (subTab === 'control') {
    loadAdminControlPanel();
  }
}

function loadAdminPanel() {
  switchAdminSubTab(activeAdminSubTab);
}

async function loadPendingUsers() {
  const container = document.getElementById("pending-users-list");
  container.innerHTML = `<div style="text-align:center; padding:1.5rem; font-size:0.8rem; color:var(--color-text-muted);">Cargando registros pendientes...</div>`;

  try {
    const res = await fetch("/api/admin/pending");
    if (res.status === 200) {
      pendingUsers = await res.json();
      renderPendingUsers();
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding:1.5rem; font-size:0.8rem; color:var(--color-danger);">Error de red.</div>`;
  }
}

function renderPendingUsers() {
  const container = document.getElementById("pending-users-list");
  container.innerHTML = "";
  
  const searchVal = document.getElementById("search-pending-users").value.toLowerCase().trim();
  const filtered = pendingUsers.filter(u => 
    u.name.toLowerCase().includes(searchVal) || u.tlf_number.includes(searchVal)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:1.5rem; font-size:0.8rem; color:var(--color-text-muted); background-color:#F8FAFC; border-radius:10px;">No hay registros pendientes de aprobación en este momento.</div>`;
    return;
  }

  filtered.forEach(u => {
    const row = document.createElement("div");
    row.className = "user-row-card";
    row.innerHTML = `
      <div class="user-row-info">
        <h4>${escapeHTML(u.name)}</h4>
        <span>Tlf: <strong>${escapeHTML(u.tlf_number)}</strong> | Fecha: ${new Date(u.created_at).toLocaleDateString()}</span>
      </div>
      <div class="user-row-actions">
        <button onclick="approveUser(${u.id})" class="btn btn-sm btn-primary">Aprobar</button>
        <button onclick="rejectUser(${u.id})" class="btn btn-sm btn-secondary" style="color:var(--color-danger);">Rechazar</button>
      </div>
    `;
    container.appendChild(row);
  });
}

async function approveUser(userId) {
  try {
    const res = await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      alert("Usuario aprobado con éxito. Ya tiene acceso.");
      loadPendingUsers();
    }
  } catch (err) {
    console.error("Approve failed:", err);
  }
}

async function rejectUser(userId) {
  if (!confirm("¿Seguro de rechazar y denegar acceso a este usuario?")) return;
  try {
    const res = await fetch("/api/admin/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadPendingUsers();
    }
  } catch (err) {
    console.error("Reject failed:", err);
  }
}

async function loadAdminDashboard() {
  const tbody = document.getElementById("dashboard-table-body");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">Cargando dashboard...</td></tr>`;

  try {
    const res = await fetch("/api/admin/dashboard");
    if (res.status === 200) {
      const data = await res.json();
      
      // Load metrics
      document.getElementById("metric-users").textContent = data.metrics.total_users;
      document.getElementById("metric-items").textContent = data.metrics.total_items;
      document.getElementById("metric-revenue").textContent = `${data.metrics.total_revenue.toFixed(2)}€`;
      
      adminDashboardRows = data.rows;
      renderAdminDashboard();
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-danger);">Error de conexión.</td></tr>`;
  }
}

function renderAdminDashboard() {
  const tbody = document.getElementById("dashboard-table-body");
  tbody.innerHTML = "";

  const searchVal = document.getElementById("search-dashboard").value.toLowerCase().trim();
  const filtered = adminDashboardRows.filter(r => 
    r.user_name.toLowerCase().includes(searchVal) || r.user_tlf.includes(searchVal)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No se encontraron registros de pedidos.</td></tr>`;
    return;
  }

  filtered.forEach(r => {
    const tr = document.createElement("tr");
    
    // Format sizes
    const sizes = JSON.parse(r.sizes_json);
    const sizesStr = Object.entries(sizes)
      .map(([k,v]) => `${k}:${v}`)
      .join(", ");
      
    let paymentBadge = "badge-neutral";
    if (r.payment_status === 'Paid') paymentBadge = "badge-success";
    else if (r.payment_status === 'Cancel') paymentBadge = "badge-danger";
    
    const isPickedUp = r.picked_up === 1;

    tr.innerHTML = `
      <td>
        <strong style="display:block;">${escapeHTML(r.user_name)}</strong>
        <span style="font-size:0.7rem; color:var(--color-text-muted);">Tlf: ${escapeHTML(r.user_tlf)}</span>
      </td>
      <td>
        <strong style="color:var(--color-primary-dark); font-size:0.75rem;">${escapeHTML(r.item_name)}</strong>
        <div style="font-size:0.7rem; color:var(--color-text-muted);">Tallas: ${sizesStr}</div>
      </td>
      <td style="font-weight:700;">${r.total_price.toFixed(2)}€</td>
      <td>
        <select onchange="updateOrderPaymentStatus(${r.order_id}, this.value)" style="padding:0.2rem; font-size:0.7rem; border-radius:4px; font-weight:600;" class="badge ${paymentBadge}">
          <option value="Not Paid" ${r.payment_status === 'Not Paid' ? 'selected' : ''}>Sin Pagar</option>
          <option value="Paid" ${r.payment_status === 'Paid' ? 'selected' : ''}>Pagado</option>
          <option value="Cancel" ${r.payment_status === 'Cancel' ? 'selected' : ''}>Cancelar</option>
        </select>
      </td>
      <td>
        <strong style="display:block; font-size:0.75rem;">${escapeHTML(r.delivery_point) || 'No asignado'}</strong>
        <span class="badge ${isPickedUp ? 'badge-success' : 'badge-warning'}">${isPickedUp ? 'Recogido' : 'Pendiente'}</span>
      </td>
      <td>
        <button onclick="adminTogglePickup(${r.order_id}, ${isPickedUp ? 0 : 1})" class="btn btn-sm btn-secondary" style="padding:0.2rem 0.4rem; font-size:0.65rem;">
          ${isPickedUp ? 'Marcar Pendiente' : 'Marcar Recogido'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function updateOrderPaymentStatus(orderId, newStatus) {
  try {
    const res = await fetch("/api/orders/payment-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, payment_status: newStatus })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadAdminDashboard();
    }
  } catch (err) {
    console.error("Failed to update payment status:", err);
  }
}

async function adminTogglePickup(orderId, pickedUp) {
  try {
    const res = await fetch("/api/orders/pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, picked_up: pickedUp })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      loadAdminDashboard();
    }
  } catch (err) {
    console.error("Failed to toggle pickup status:", err);
  }
}

// Admin Control Pane
async function loadAdminControlPanel() {
  // Load catalogue items to dropdown selection
  const select = document.getElementById("poll-linked-item");
  select.innerHTML = `<option value="">Ninguna - Encuesta de Texto Simple</option>`;
  
  try {
    const res = await fetch("/api/catalogue");
    if (res.status === 200) {
      const items = await res.json();
      items.forEach(i => {
        const opt = document.createElement("option");
        opt.value = i.id;
        opt.textContent = i.name;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Failed to load items in control panel:", err);
  }
}

async function createPoll() {
  const question = document.getElementById("poll-question").value.trim();
  const optionsInput = document.getElementById("poll-options").value.trim();
  const catalogueId = document.getElementById("poll-linked-item").value;

  if (!question || !optionsInput) {
    alert("Pregunta y opciones obligatorias.");
    return;
  }

  // Parse options split by commas
  const options = optionsInput.split(',').map(o => o.trim()).filter(o => o.length > 0);
  if (options.length < 2) {
    alert("Por favor, introduce al menos dos opciones separadas por comas.");
    return;
  }

  try {
    const res = await fetch("/api/polls/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question,
        options: options,
        catalogue_id: catalogueId ? parseInt(catalogueId) : null
      })
    });
    
    const data = await res.json();
    if (res.status === 200 && data.success) {
      alert("¡Encuesta creada y publicada con éxito!");
      document.getElementById("form-create-poll").reset();
      switchAdminSubTab('users');
    } else {
      alert("Error: " + data.error);
    }
  } catch (err) {
    alert("Error de red al crear la encuesta.");
  }
}

// Add client-side implementation of updateDeliveryPoint for javascript
async function updateDeliveryPoint(orderId, point, details = "") {
  try {
    const res = await fetch("/api/orders/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        delivery_point: point,
        delivery_details: details
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.success) {
      alert("¡Punto de recogida actualizado con éxito!");
      loadDeliveryModule();
    } else {
      alert("Error al actualizar punto: " + data.error);
    }
  } catch (err) {
    console.error("Failed to update delivery point:", err);
  }
}

async function exportDashboardCSV(event) {
  if (event) event.preventDefault();
  try {
    const res = await fetch("/api/admin/export-csv");
    if (res.status === 200) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "AppCamisetas_Dashboard_Dani.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      alert("Error al exportar CSV.");
    }
  } catch (err) {
    console.error("Export CSV failed:", err);
  }
}
