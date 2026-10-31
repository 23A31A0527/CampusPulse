
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Bell,
  MapPin,
  Wifi,
  Monitor,
  Droplets,
  Wrench,
  X,
  Filter,
  Activity
} from "lucide-react";

import "./App.css";

const initialIssues = [
  {
    id: 1,
    title: "Wi-Fi not working in Block A",
    category: "Internet",
    location: "Block A",
    description: "Students cannot connect to campus Wi-Fi.",
    severity: "High",
    people: 80,
    status: "Pending",
    date: "2026-10-30"
  },
  {
    id: 2,
    title: "Projector malfunction",
    category: "Equipment",
    location: "Room 204",
    description: "Classroom projector is not displaying properly.",
    severity: "Medium",
    people: 35,
    status: "In Progress",
    date: "2026-10-29"
  },
  {
    id: 3,
    title: "Water leakage near washroom",
    category: "Water",
    location: "Block B",
    description: "Continuous water leakage near washroom.",
    severity: "High",
    people: 50,
    status: "Pending",
    date: "2026-10-28"
  },
  {
    id: 4,
    title: "Broken classroom fan",
    category: "Maintenance",
    location: "Room 105",
    description: "One ceiling fan is not functioning.",
    severity: "Low",
    people: 30,
    status: "Resolved",
    date: "2026-10-27"
  }
];

const categories = [
  "Internet",
  "Equipment",
  "Water",
  "Maintenance",
  "Other"
];

// Smart priority calculation
function getPriority(severity, people) {
  const severityScore = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4
  };

  return (
    severityScore[severity] * 25 +
    Math.min(Number(people), 100) * 0.5
  );
}

function getPriorityLabel(issue) {
  const score = getPriority(issue.severity, issue.people);

  if (score >= 125) return "Critical";
  if (score >= 100) return "High";
  if (score >= 75) return "Medium";

  return "Low";
}

function App() {
  const [issues, setIssues] = useState(() => {
    try {
      const saved = localStorage.getItem("campuspulse_issues");
      return saved ? JSON.parse(saved) : initialIssues;
    } catch {
      return initialIssues;
    }
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    category: "Internet",
    location: "",
    description: "",
    severity: "Medium",
    people: 10
  });

  // Save issues in browser storage
  useEffect(() => {
    localStorage.setItem(
      "campuspulse_issues",
      JSON.stringify(issues)
    );
  }, [issues]);

  // Dashboard statistics
  const pending = issues.filter(
    issue => issue.status === "Pending"
  ).length;

  const progress = issues.filter(
    issue => issue.status === "In Progress"
  ).length;

  const resolved = issues.filter(
    issue => issue.status === "Resolved"
  ).length;

  const critical = issues.filter(
    issue =>
      (issue.severity === "Critical" ||
        issue.severity === "High") &&
      issue.status !== "Resolved"
  ).length;

  // Search, filter and prioritize issues
  const filteredIssues = issues
    .filter(issue => {
      const matchesSearch =
        issue.title.toLowerCase().includes(search.toLowerCase()) ||
        issue.location.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" || issue.status === filter;

      return matchesSearch && matchesFilter;
    })
    .sort(
      (a, b) =>
        getPriority(b.severity, b.people) -
        getPriority(a.severity, a.people)
    );

  // Submit new issue
  function handleSubmit(e) {
    e.preventDefault();

    const duplicate = issues.find(
      issue =>
        issue.title.toLowerCase().trim() ===
          form.title.toLowerCase().trim() &&
        issue.location.toLowerCase().trim() ===
          form.location.toLowerCase().trim() &&
        issue.status !== "Resolved"
    );

    if (duplicate) {
      alert(
        "A similar active issue already exists at this location."
      );
      return;
    }

    const newIssue = {
      ...form,
      id: Date.now(),
      people: Number(form.people),
      status: "Pending",
      date: new Date().toISOString().slice(0, 10)
    };

    setIssues(prev => [newIssue, ...prev]);

    setForm({
      title: "",
      category: "Internet",
      location: "",
      description: "",
      severity: "Medium",
      people: 10
    });

    setShowForm(false);
  }

  // Update issue status
  function updateStatus(id, status) {
    setIssues(prev =>
      prev.map(issue =>
        issue.id === id
          ? { ...issue, status }
          : issue
      )
    );
  }

  function categoryIcon(category) {
    switch (category) {
      case "Internet":
        return <Wifi size={18} />;
      case "Equipment":
        return <Monitor size={18} />;
      case "Water":
        return <Droplets size={18} />;
      default:
        return <Wrench size={18} />;
    }
  }

  return (
    <div className="app-layout">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">
            <Activity size={23} />
          </div>

          <span>
            Campus<span className="brand-highlight">Pulse</span>
          </span>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          <a className="nav-item active" href="#dashboard">
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a className="nav-item" href="#issues">
            <ClipboardList size={19} />
            All Issues
          </a>

          <a
            className="nav-item"
            href="#issues"
            onClick={() => setFilter("Pending")}
          >
            <Clock size={19} />
            Pending Issues
          </a>

          <a
            className="nav-item"
            href="#issues"
            onClick={() => setFilter("Resolved")}
          >
            <CheckCircle2 size={19} />
            Resolved Issues
          </a>
        </nav>

        <div className="sidebar-bottom">

          <div className="help-card">
            <div className="help-icon">
              <Activity size={20} />
            </div>

            <strong>CampusPulse</strong>

            <p>
              Making campus life better, one solution at a time.
            </p>
          </div>

          <div className="user-profile">
            <div className="avatar">AD</div>

            <div>
              <strong>Campus Admin</strong>
              <span>Administrator</span>
            </div>
          </div>

        </div>
      </aside>

      {/* MAIN DASHBOARD */}
      <main className="main-content" id="dashboard">

        {/* HEADER */}
        <header className="topbar">

          <div>
            <span className="breadcrumb">
              Workspace / Overview
            </span>

            <h2>Dashboard</h2>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <span className="notification-dot"></span>
            </button>

            <div className="avatar">AD</div>
          </div>

        </header>

        {/* WELCOME */}
        <section className="welcome-section">

          <div>
            <h1>Good morning, Admin 👋</h1>

            <p>
              Here's what's happening around your campus today.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => setShowForm(true)}
          >
            <Plus size={18} />
            Report an Issue
          </button>

        </section>

        {/* STATISTICS */}
        <section className="stats-grid">

          <StatCard
            title="Total Issues"
            value={issues.length}
            icon={<ClipboardList />}
            color="blue"
          />

          <StatCard
            title="Pending"
            value={pending}
            icon={<Clock />}
            color="orange"
          />

          <StatCard
            title="In Progress"
            value={progress}
            icon={<Activity />}
            color="purple"
          />

          <StatCard
            title="Resolved"
            value={resolved}
            icon={<CheckCircle2 />}
            color="green"
          />

        </section>

        {/* PRIORITY ALERT */}
        <section className="priority-banner">

          <div className="priority-symbol">
            <AlertTriangle size={22} />
          </div>

          <div className="priority-text">
            <strong>
              {critical} high-impact issue
              {critical !== 1 ? "s" : ""} need attention
            </strong>

            <span>
              Review unresolved high and critical severity reports first.
            </span>
          </div>

          <a href="#issues">
            Review issues
          </a>

        </section>

        {/* ISSUE MANAGEMENT */}
        <section className="issues-section" id="issues">

          <div className="section-heading">

            <div>
              <h3>Recent Issues</h3>

              <p>
                Monitor and manage campus complaints.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => setShowForm(true)}
            >
              <Plus size={17} />
              New Issue
            </button>

          </div>

          {/* SEARCH AND FILTER */}
          <div className="table-toolbar">

            <div className="search-box">
              <Search size={17} />

              <input
                placeholder="Search issues or locations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-box">
              <Filter size={16} />

              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
              >
                <option value="All">All Issues</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

          </div>

          {/* ISSUES TABLE */}
          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>ISSUE DETAILS</th>
                  <th>LOCATION</th>
                  <th>PRIORITY</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>

                {filteredIssues.map(issue => (

                  <tr key={issue.id}>

                    <td>
                      <div className="issue-name">

                        <div className="category-icon">
                          {categoryIcon(issue.category)}
                        </div>

                        <div>
                          <strong>{issue.title}</strong>

                          <span>
                            {issue.category} · {issue.people} people affected
                          </span>
                        </div>

                      </div>
                    </td>

                    <td>
                      <span className="location">
                        <MapPin size={14} />
                        {issue.location}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`priority ${getPriorityLabel(issue).toLowerCase()}`}
                      >
                        {getPriorityLabel(issue)}
                      </span>
                    </td>

                    <td className="date-cell">
                      {issue.date}
                    </td>

                    <td>
                      <span
                        className={`status ${issue.status
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {issue.status}
                      </span>
                    </td>

                    <td>
                      <select
                        className="action-select"
                        value={issue.status}
                        onChange={e =>
                          updateStatus(issue.id, e.target.value)
                        }
                        aria-label={`Update status for ${issue.title}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>

                  </tr>

                ))}

                {filteredIssues.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No issues found. Try another search or report a new issue.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>

          </div>

          <div className="table-footer">
            Showing {filteredIssues.length} of {issues.length} issues
          </div>

        </section>

        <footer className="footer">
          CampusPulse © 2026 · Built to make campuses better.
        </footer>

      </main>

      {/* NEW ISSUE MODAL */}
      {showForm && (

        <div
          className="modal-overlay"
          onClick={() => setShowForm(false)}
        >

          <div
            className="modal"
            onClick={e => e.stopPropagation()}
          >

            <div className="modal-header">

              <div>
                <h3>Report a new issue</h3>

                <p>
                  Provide details to help us resolve the problem.
                </p>
              </div>

              <button
                className="close-button"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
              >
                <X />
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              <label>Issue title *</label>

              <input
                required
                placeholder="e.g. Wi-Fi not working in Block A"
                value={form.title}
                onChange={e =>
                  setForm({ ...form, title: e.target.value })
                }
              />

              <label>Category</label>

              <select
                value={form.category}
                onChange={e =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label>Campus location *</label>

              <input
                required
                placeholder="e.g. Block A, Room 201"
                value={form.location}
                onChange={e =>
                  setForm({ ...form, location: e.target.value })
                }
              />

              <label>Description</label>

              <textarea
                placeholder="Describe the problem..."
                value={form.description}
                onChange={e =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <div className="form-row">

                <div>
                  <label>Severity</label>

                  <select
                    value={form.severity}
                    onChange={e =>
                      setForm({ ...form, severity: e.target.value })
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>

                <div>
                  <label>People affected</label>

                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={form.people}
                    onChange={e =>
                      setForm({ ...form, people: e.target.value })
                    }
                  />
                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  <Plus size={17} />
                  Submit Issue
                </button>

              </div>

            </form>

          </div>
        </div>

      )}

    </div>
  );
}

// Reusable dashboard statistics card
function StatCard({ title, value, icon, color }) {
  return (
    <div className="stat-card">

      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <div>
        <span>{title}</span>
        <h2>{value}</h2>
      </div>

    </div>
  );
}

export default App;
