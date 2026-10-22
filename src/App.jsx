
import { useEffect, useState } from "react";
import axios from "axios";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Menu,
  X,
} from "lucide-react";
import "./App.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "https://examen-nodejs-octobre-2026-1.onrender.com"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});



function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("taskflow_token") || ""
  );
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("taskflow_user") || "null");
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projectPagination, setProjectPagination] = useState({});
  const [taskPagination, setTaskPagination] = useState({});
  const [projectPage, setProjectPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [projectStatus, setProjectStatus] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [taskPriority, setTaskPriority] = useState("");

  function logout(message = "") {
    localStorage.removeItem("taskflow_token");
    localStorage.removeItem("taskflow_user");
    setToken("");
    setUser(null);
    setStats(null);
    setUsers([]);
    setError(message);
  }

  async function request(config) {
    try {
      return await api.request({
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      if (err.response?.status === 401) {
        logout("Session expirée. Connectez-vous à nouveau.");
      }
      throw err;
    }
  }


  
async function loadProjects(targetPage = projectPage, filters = {}) {
  const response = await request({
    url: "/api/admin/projects",
    params: {
      page: targetPage,
      limit: 10,
      q: filters.q ?? search,
      status: filters.status ?? projectStatus,
    },
  });

  setProjects(response.data.data || []);
  setProjectPagination(response.data.pagination || {});
  setProjectPage(targetPage);
}

async function loadTasks(targetPage = taskPage, filters = {}) {
  const response = await request({
    url: "/api/admin/tasks",
    params: {
      page: targetPage,
      limit: 10,
      q: filters.q ?? search,
      status: filters.status ?? taskStatus,
      priority: filters.priority ?? taskPriority,
    },
  });

  setTasks(response.data.data || []);
  setTaskPagination(response.data.pagination || {});
  setTaskPage(targetPage);
}

  async function login(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/login", {
        email,
        password,
      });

      const data = response.data;
      if (data.user?.role !== "ADMIN") {
        setError("Accès refusé : un compte ADMIN est nécessaire.");
        return;
      }

      localStorage.setItem("taskflow_token", data.token);
      localStorage.setItem("taskflow_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Connexion impossible. Vérifiez que l'API fonctionne."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const response = await request({ url: "/api/admin/stats" });
    setStats(response.data.data);
  }

  async function loadUsers(targetPage = currentPage) {
    const response = await request({
      url: "/api/admin/users",
      params: { page: targetPage, limit: 10 },
    });
    setUsers(response.data.data || []);
    setPagination(response.data.pagination || {});
    setCurrentPage(targetPage);
  }

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadProjects(),
        loadTasks(),
      ]);
    } catch (err) {
      if (err.response?.status === 403) {
        logout("Accès réservé aux administrateurs.");
      } else if (err.response?.status !== 401) {
        setError(
          err.response?.data?.message ||
            "Impossible de charger les données."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verifySession() {
      try {
        const response = await api.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        const connectedUser = response.data.user || response.data.data;
        if (connectedUser?.role !== "ADMIN") {
          logout("Accès réservé aux administrateurs.");
          return;
        }

        setUser(connectedUser);
        localStorage.setItem(
          "taskflow_user",
          JSON.stringify(connectedUser)
        );
      } catch (err) {
        if (cancelled) return;
        logout(
          err.response?.status === 403
            ? "Accès réservé aux administrateurs."
            : "Session invalide. Veuillez vous reconnecter."
        );
      }
    }

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (token && user?.role === "ADMIN") refresh();
  }, [token, user?.role]);

  async function toggleUser(account) {
    const action = account.isActive ? "désactiver" : "activer";

    if (!window.confirm(`Voulez-vous ${action} ${account.name} ?`)) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request({
        url: `/api/admin/users/${account._id || account.id}/status`,
        method: "PATCH",
        data: { isActive: !account.isActive },
      });

      setNotice(`Compte ${action === "activer" ? "activé" : "désactivé"}.`);
      await Promise.all([loadUsers(), loadStats()]);
    } catch (err) {
      setError(
        err.response?.data?.message || "Modification du compte impossible."
      );
    }
  }

  const filteredUsers = users.filter((account) =>
    `${account.name} ${account.email}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (!token || !user) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <div className="brand-mark"><CheckSquare size={28} /></div>
          <p className="eyebrow">TASKFLOW ADMINISTRATION</p>
          <h1>Bienvenue</h1>
          <p className="muted">Connectez-vous avec votre compte administrateur.</p>

          {error && <div className="alert error">{error}</div>}

          <label htmlFor="email">Adresse email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@exemple.com"
            required
          />

          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
            required
          />

          <button className="primary full-width" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
          <p className="login-foot">Accès réservé aux administrateurs.</p>
        </form>
      </main>
    );
  }

  const navigation = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "projects", label: "Projets", icon: FolderKanban },
    { id: "tasks", label: "Tâches", icon: CheckSquare },
  ];

  const cards = [
    {
      label: "Utilisateurs",
      value: stats?.users?.total ?? "—",
      detail: `${stats?.users?.active ?? 0} comptes actifs`,
      icon: Users,
    },
    {
      label: "Projets",
      value: stats?.projects?.total ?? "—",
      detail: "Projets enregistrés",
      icon: FolderKanban,
    },
    {
      label: "Tâches",
      value: stats?.tasks?.total ?? "—",
      detail: "Tâches enregistrées",
      icon: CheckSquare,
    },
    {
      label: "Tâches terminées",
      value: stats?.tasks?.completed ?? "—",
      detail: "Travail accompli",
      icon: UserCheck,
    },
  ];

  return (
    <div className="admin-layout">
      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Fermer le menu"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <CheckSquare size={23} />
          </span>
          <span>
            TaskFlow <small>ADMIN</small>
          </span>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>

        <p className="nav-heading">ESPACE ADMINISTRATION</p>
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => {
                  setPage(item.id);
                  setMobileMenu(false);
                  setError("");
                  setNotice("");
                }}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">
              {(user.name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{user.name}</strong>
              <span>Administrateur</span>
            </div>
          </div>
          <button className="logout-button" onClick={() => logout()}>
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu-button"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={22} />
          </button>
          <div>
            <p className="eyebrow">ESPACE DE GESTION</p>
            <h2>{navigation.find((item) => item.id === page)?.label}</h2>
          </div>
          <button
            className="refresh-button"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Actualiser
          </button>
        </header>

        <section className="content">
          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert success">{notice}</div>}

          {page === "dashboard" && (
            <>
              <div className="welcome-row">
                <div>
                  <h1>Vue d'ensemble</h1>
                  <p className="muted">
                    Voici les statistiques globales de TaskFlow.
                  </p>
                </div>
                <span className="secure-label">
                  <ShieldCheck size={16} /> Espace sécurisé
                </span>
              </div>

              <div className="stats-grid">
                {cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <article className="stat-card" key={card.label}>
                      <div className="stat-top">
                        <span>{card.label}</span>
                        <span className="stat-icon">
                          <Icon size={20} />
                        </span>
                      </div>
                      <strong className="stat-value">{card.value}</strong>
                      <span className="stat-detail">{card.detail}</span>
                    </article>
                  );
                })}
              </div>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>État des comptes</h3>
                    <p className="muted">Répartition des utilisateurs</p>
                  </div>
                  <Users size={21} />
                </div>
                <div className="account-summary">
                  <div>
                    <span className="dot green" /> Actifs{" "}
                    <strong>{stats?.users?.active ?? 0}</strong>
                  </div>
                  <div>
                    <span className="dot orange" /> Inactifs{" "}
                    <strong>{stats?.users?.inactive ?? 0}</strong>
                  </div>
                  <div>
                    <span className="dot purple" /> Total{" "}
                    <strong>{stats?.users?.total ?? 0}</strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {page === "users" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Gestion des utilisateurs</h3>
                  <p className="muted">
                    {pagination.total ?? 0} utilisateur(s) au total
                  </p>
                </div>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                  />
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Rôle</th>
                      <th>Inscription</th>
                      <th>Statut</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((account) => (
                      <tr key={account._id || account.id}>
                        <td>
                          <div className="user-cell">
                            <div className="avatar light">
                              {(account.name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong>{account.name}</strong>
                              <span>{account.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="role-tag">{account.role}</span>
                        </td>
                        <td>
                          {account.createdAt
                            ? new Date(account.createdAt).toLocaleDateString(
                                "fr-FR",
                              )
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`status-tag ${account.isActive ? "status-active" : "status-inactive"}`}
                          >
                            {account.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`action-button ${account.isActive ? "deactivate" : "activate"}`}
                            onClick={() => toggleUser(account)}
                            disabled={
                              account.role === "ADMIN" &&
                              account._id === user.id
                            }
                          >
                            {account.isActive ? (
                              <UserX size={15} />
                            ) : (
                              <UserCheck size={15} />
                            )}
                            {account.isActive ? "Désactiver" : "Activer"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          Aucun utilisateur trouvé.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Page {pagination.page ?? currentPage} sur{" "}
                  {pagination.totalPages ?? 1}
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => loadUsers(currentPage - 1)}
                  >
                    Précédent
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      currentPage >= (pagination.totalPages || 1) || loading
                    }
                    onClick={() => loadUsers(currentPage + 1)}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </section>
          )}

          {page === "projects" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Gestion des projets</h3>
                  <p className="muted">
                    {projectPagination.total ?? 0} projet(s) au total
                  </p>
                </div>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    placeholder="Rechercher un projet..."
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadProjects(1, { q: search });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="filters">
                <select
                  value={projectStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProjectStatus(value);
                    loadProjects(1, { status: value });
                  }}
                >
                  <option value="">Tous les statuts</option>
                  <option value="ACTIVE">Actif</option>
                  <option value="COMPLETED">Terminé</option>
                  <option value="ARCHIVED">Archivé</option>
                </select>
                <button className="secondary" onClick={() => loadProjects()}>
                  Rechercher
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Projet</th>
                      <th>Responsable</th>
                      <th>Membres</th>
                      <th>Statut</th>
                      <th>Création</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project._id}>
                        <td>
                          <strong>{project.name}</strong>
                          <div className="muted">
                            {project.description || "Aucune description"}
                          </div>
                        </td>
                        <td>
                          {project.owner?.name || "Non attribué"}
                          <div className="muted">
                            {project.owner?.email || ""}
                          </div>
                        </td>
                        <td>{project.members?.length ?? 0}</td>
                        <td>
                          <span className="status-tag">
                            {project.status || "—"}
                          </span>
                        </td>
                        <td>
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString(
                                "fr-FR",
                              )
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          Aucun projet trouvé.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Page {projectPagination.page ?? projectPage} sur{" "}
                  {projectPagination.totalPages ?? 1}
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={projectPage <= 1 || loading}
                    onClick={() => loadProjects(projectPage - 1)}
                  >
                    Précédent
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      projectPage >= (projectPagination.totalPages || 1) ||
                      loading
                    }
                    onClick={() => loadProjects(projectPage + 1)}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </section>
          )}

          {page === "tasks" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Gestion des tâches</h3>
                  <p className="muted">
                    {taskPagination.total ?? 0} tâche(s) au total
                  </p>
                </div>
                <div className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    placeholder="Rechercher une tâche..."
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadTasks(1, { q: search });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="filters">
                <select
                  value={taskStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTaskStatus(value);
                    loadTasks(1, { status: value });
                  }}
                >
                  <option value="">Tous les statuts</option>
                  <option value="TODO">À faire</option>
                  <option value="IN_PROGRESS">En cours</option>
                  <option value="DONE">Terminée</option>
                </select>

                <select
                  value={taskPriority}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTaskPriority(value);
                    loadTasks(1, { priority: value });
                  }}
                >
                  <option value="">Toutes les priorités</option>
                  <option value="LOW">Faible</option>
                  <option value="MEDIUM">Moyenne</option>
                  <option value="HIGH">Haute</option>
                  <option value="URGENT">Urgente</option>
                </select>

                <button className="secondary" onClick={() => loadTasks()}>
                  Rechercher
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tâche</th>
                      <th>Projet</th>
                      <th>Assignée à</th>
                      <th>Priorité</th>
                      <th>Statut</th>
                      <th>Échéance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task._id}>
                        <td>
                          <strong>{task.title}</strong>
                          <div className="muted">
                            {task.description || "Aucune description"}
                          </div>
                        </td>
                        <td>{task.project?.name || "—"}</td>
                        <td>
                          {task.assignedTo?.name || "Non attribuée"}
                          <div className="muted">
                            {task.assignedTo?.email || ""}
                          </div>
                        </td>
                        <td>
                          <span className="status-tag">
                            {task.priority || "—"}
                          </span>
                        </td>
                        <td>
                          <span className="status-tag">
                            {task.status || "—"}
                          </span>
                        </td>
                        <td>
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString("fr-FR")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan="6" className="empty-state">
                          Aucune tâche trouvée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>
                  Page {taskPagination.page ?? taskPage} sur{" "}
                  {taskPagination.totalPages ?? 1}
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={taskPage <= 1 || loading}
                    onClick={() => loadTasks(taskPage - 1)}
                  >
                    Précédent
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      taskPage >= (taskPagination.totalPages || 1) || loading
                    }
                    onClick={() => loadTasks(taskPage + 1)}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
