
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, getDoc, collection, addDoc, query, where, onSnapshot,
  updateDoc, serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";
import Auth from "./Auth";
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
  Activity,
  BarChart3,
  ShieldAlert as ShieldAlertIcon,
  Lightbulb as LightbulbIcon,
  Repeat
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

import "./App.css";

// =====================================
// INITIAL SAMPLE DATA
// =====================================

const categories = [
  "Internet",
  "Equipment",
  "Water",
  "Maintenance",
  "Other"
];

const CHART_COLORS = [
  "#2563eb",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ec4899"
];

// =====================================
// PRIORITY CALCULATION
// =====================================

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
  const score = getPriority(
    issue.severity,
    issue.people
  );

  if (score >= 125) return "Critical";
  if (score >= 100) return "High";
  if (score >= 75) return "Medium";

  return "Low";
}

// =====================================
// AUTOMATIC COMPLAINT ESCALATION
// =====================================

// Unresolved complaints are flagged when they remain open beyond
// the response window assigned to their severity.
function getEscalationInfo(issue) {
  if (issue.status === "Resolved" || !issue.date) {
    return { isEscalated: false, overdueDays: 0, responseDays: 0 };
  }

  const responseWindows = {
    Critical: 1,
    High: 2,
    Medium: 4,
    Low: 7
  };

  const responseDays = responseWindows[issue.severity] || 4;
  const reportedAt = new Date(`${issue.date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(reportedAt.getTime())) {
    return { isEscalated: false, overdueDays: 0, responseDays };
  }

  const elapsedDays = Math.floor(
    (today.getTime() - reportedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const overdueDays = Math.max(0, elapsedDays - responseDays);

  return {
    isEscalated: elapsedDays > responseDays,
    overdueDays,
    responseDays
  };
}

// =====================================
// DUPLICATE DETECTION
// =====================================

function normalizeComplaint(title) {
  return title
    .toLowerCase()
    .replace(
      /not working|not functioning|doesn't work|does not work/g,
      "broken"
    )
    .replace(
      /malfunctioning|malfunction|failure|faulty|damaged/g,
      "broken"
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(word =>
      word.length > 2 &&
      ![
        "the",
        "and",
        "for",
        "with",
        "near",
        "issue",
        "problem"
      ].includes(word)
    );
}

function calculateSimilarity(title1, title2) {
  const words1 = new Set(normalizeComplaint(title1));
  const words2 = new Set(normalizeComplaint(title2));

  const common = [...words1].filter(word =>
    words2.has(word)
  );

  const total = new Set([...words1, ...words2]);

  return total.size === 0
    ? 0
    : common.length / total.size;
}

function normalizeLocation(location) {
  return location
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findSimilarIssues(newIssue, existingIssues) {
  return existingIssues.filter(issue => {
    const sameCategory =
      issue.category === newIssue.category;

    const similarity = calculateSimilarity(
      issue.title,
      newIssue.title
    );

    return (
      sameCategory &&
      similarity >= 0.5 &&
      issue.status !== "Resolved"
    );
  });
}

// =====================================
// CATEGORY ICON
// =====================================

function CategoryIcon({ category }) {
  switch (category) {
    case "Internet":
      return <Wifi size={18} />;

    case "Equipment":
      return <Monitor size={18} />;

    case "Water":
      return <Droplets size={18} />;

    case "Maintenance":
      return <Wrench size={18} />;

    default:
      return <ClipboardList size={18} />;
  }
}

// =====================================
// FIRESTORE NOTIFICATIONS
// =====================================

async function createNotification(notification) {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notification,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Could not create notification:", error);
  }
}

function NotificationBell({ user, role }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const notificationsRef = collection(db, "notifications");
    const received = new Map();
    const publish = () => {
      setNotifications(
        [...received.values()].sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        })
      );
    };

    const personalQuery = query(
      notificationsRef,
      where("recipientId", "==", user.uid)
    );
    const stopPersonal = onSnapshot(personalQuery, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") received.delete(change.doc.id);
        else received.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
      });
      publish();
    }, error => console.error("Personal notifications error:", error));

    let stopAdmin = () => {};
    if (role === "admin") {
      const adminQuery = query(
        notificationsRef,
        where("recipientRole", "==", "admin")
      );
      stopAdmin = onSnapshot(adminQuery, snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === "removed") received.delete(change.doc.id);
          else received.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        });
        publish();
      }, error => console.error("Admin notifications error:", error));
    }

    return () => {
      stopPersonal();
      stopAdmin();
    };
  }, [user?.uid, role]);

  const unreadCount = notifications.filter(item => !item.read).length;

  async function markAsRead(item) {
    if (item.read) return;
    try {
      await updateDoc(doc(db, "notifications", item.id), { read: true });
    } catch (error) {
      console.error("Could not mark notification as read:", error);
    }
  }

  async function markAllRead() {
    await Promise.all(
      notifications.filter(item => !item.read).map(item =>
        updateDoc(doc(db, "notifications", item.id), { read: true })
      )
    );
  }

  return (
    <div className="notification-wrapper">
      <button
        type="button"
        className="icon-button notification-trigger"
        aria-label={`Notifications, ${unreadCount} unread`}
        onClick={() => setOpen(value => !value)}
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
            {unreadCount > 0 && <button type="button" onClick={markAllRead}>Mark all read</button>}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="notification-empty">You're all caught up!</p>
            ) : notifications.map(item => (
              <button
                type="button"
                key={item.id}
                className={`notification-item ${item.read ? "is-read" : "is-unread"}`}
                onClick={() => markAsRead(item)}
              >
                <span className="notification-item-dot" />
                <span><strong>{item.title}</strong><small>{item.message}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================
// MAIN APPLICATION
// =====================================

function App() {
  // Firebase authentication and Firestore role lookup
  const [authUser, setAuthUser] = useState(null);
  const [authRole, setAuthRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);

      if (!user) {
        setAuthRole(null);
        setAuthLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        // Unknown or missing roles are treated as student, never admin.
        const savedRole = userSnapshot.exists()
          ? userSnapshot.data().role
          : null;

        setAuthRole(savedRole === "admin" ? "admin" : "student");
      } catch (error) {
        console.error("Could not load user role:", error);
        setAuthRole("student");
      } finally {
        setAuthLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed:", error);
  }
};
  // Live Firestore complaints: admins see all, students see only their own.
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authUser?.uid || !authRole) {
      setIssues([]);
      setIssuesLoading(false);
      return;
    }

    const issuesRef = collection(db, "issues");
    const issuesQuery = authRole === "admin"
      ? issuesRef
      : query(issuesRef, where("reportedBy", "==", authUser.uid));

    const unsubscribe = onSnapshot(
      issuesQuery,
      snapshot => {
        const loaded = snapshot.docs.map(issueDoc => ({
          id: issueDoc.id,
          ...issueDoc.data()
        }));
        loaded.sort((a, b) =>
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
        setIssues(loaded);
        setIssuesLoading(false);
      },
      error => {
        console.error("Could not load complaints from Firestore:", error);
        setIssuesLoading(false);
      }
    );

    return unsubscribe;
  }, [authUser?.uid, authRole]);

  // =====================================
  // DASHBOARD STATISTICS
  // =====================================

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
      ["High", "Critical"].includes(issue.severity) &&
      issue.status !== "Resolved"
  ).length;

  // Automatically flag unresolved complaints that exceed their response window.
  const escalatedIssues = issues
    .filter(issue => getEscalationInfo(issue).isEscalated)
    .sort((a, b) => {
      const aInfo = getEscalationInfo(a);
      const bInfo = getEscalationInfo(b);
      return bInfo.overdueDays - aInfo.overdueDays;
    });

  // =====================================
  // ANALYTICS CALCULATIONS
  // =====================================

  // Category-wise analytics
  const categoryData = categories
    .map(category => ({
      name: category,
      value: issues.filter(
        issue => issue.category === category
      ).length
    }))
    .filter(item => item.value > 0);

  // Status-wise analytics
  const statusData = [
    { name: "Pending", total: pending },
    { name: "In Progress", total: progress },
    { name: "Resolved", total: resolved }
  ];

  // Resolution rate
  const resolutionRate = issues.length
    ? Math.round((resolved / issues.length) * 100)
    : 0;

  // Location-wise counts
  const locationCounts = issues.reduce(
    (acc, issue) => {
      const location = issue.location.trim();

      acc[location] = (acc[location] || 0) + 1;

      return acc;
    },
    {}
  );

  const topLocation = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])[0];

  // =====================================
  // SMART CAMPUS HOTSPOT DETECTION
  // =====================================

  // Rank locations by complaint count
  const hotspotData = Object.entries(locationCounts)
    .map(([location, count]) => ({
      location,
      count,
      percentage: issues.length
        ? Math.round((count / issues.length) * 100)
        : 0
    }))
    .sort((a, b) => b.count - a.count);

  // =====================================
  // RECURRING ISSUE DETECTION
  // =====================================

  const recurringMap = {};

  issues.forEach(issue => {
    const key =
      `${normalizeLocation(issue.location)}_${issue.category}`;

    if (!recurringMap[key]) {
      recurringMap[key] = {
        location: issue.location,
        category: issue.category,
        count: 0,
        titles: []
      };
    }

    recurringMap[key].count += 1;
    recurringMap[key].titles.push(issue.title);
  });

  const recurringIssues = Object.values(recurringMap)
    .filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count);

  // =====================================
  // HIGH-RISK LOCATION DETECTION
  // =====================================

  const riskLocations = hotspotData
    .map(location => {
      const locationIssues = issues.filter(
        issue =>
          normalizeLocation(issue.location) ===
          normalizeLocation(location.location)
      );

      const urgentCount = locationIssues.filter(
        issue =>
          ["High", "Critical"].includes(issue.severity) &&
          issue.status !== "Resolved"
      ).length;

      return {
        ...location,
        urgentCount,
        isRisk:
          urgentCount >= 2 ||
          location.count >= 3
      };
    })
    .filter(location => location.isRisk);

  // =====================================
  // SMART RECOMMENDATIONS
  // =====================================

  const recommendations = [];

  if (recurringIssues.length > 0) {
    recommendations.push({
      title: "Investigate recurring complaints",
      description:
        `Inspect ${recurringIssues[0].location} for repeated ${recurringIssues[0].category.toLowerCase()} problems.`,
      type: "warning"
    });
  }

  if (riskLocations.length > 0) {
    recommendations.push({
      title: "Prioritize high-risk locations",
      description:
        `${riskLocations[0].location} needs administrator attention.`,
      type: "danger"
    });
  }

  if (escalatedIssues.length > 0) {
    recommendations.push({
      title: "Escalate overdue complaints",
      description:
        `${escalatedIssues.length} unresolved complaint(s) exceeded their response time. Review the oldest overdue reports first.`,
      type: "danger"
    });
  }

  if (pending > 0) {
    recommendations.push({
      title: "Clear pending complaints",
      description:
        `${pending} complaint(s) are waiting for action.`,
      type: "info"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Campus is looking good!",
      description:
        "No recurring or high-risk complaint patterns have been detected.",
      type: "success"
    });
  }

  // =====================================
  // SEARCH AND FILTER
  // =====================================

  const filteredIssues = issues
    .filter(issue => {
      const matchesSearch =
        issue.title
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        issue.location
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" ||
        issue.status === filter;

      return matchesSearch && matchesFilter;
    })
    .sort(
      (a, b) =>
        getPriority(b.severity, b.people) -
        getPriority(a.severity, a.people)
    );

  // =====================================
  // SUBMIT NEW ISSUE
  // =====================================

  async function handleSubmit(e) {
    e.preventDefault();
    if (!authUser?.uid) return;

    const newIssueData = {
      ...form,
      title: form.title.trim(),
      location: form.location.trim(),
      people: Number(form.people)
    };

    const similarIssues = findSimilarIssues(newIssueData, issues);
    const duplicate = similarIssues.find(issue =>
      normalizeLocation(issue.location) === normalizeLocation(newIssueData.location)
    );

    if (duplicate) {
      alert(`Possible duplicate detected!\\n\\nExisting issue: ${duplicate.title}\\nLocation: ${duplicate.location}\\nStatus: ${duplicate.status}`);
      return;
    }

    if (similarIssues.length > 0) {
      const locations = similarIssues.map(issue => issue.location).join(", ");
      if (!window.confirm(`Similar complaints already exist at:\\n\\n${locations}\\n\\nSubmit separately?`)) return;
    }

    try {
      const issueRef = await addDoc(collection(db, "issues"), {
        ...newIssueData,
        reportedBy: authUser.uid,
        reporterName: authUser.displayName || authUser.email,
        status: "Pending",
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (authRole === "student") {
        await createNotification({
          recipientRole: "admin",
          type: "new_complaint",
          title: "New complaint submitted",
          message: `${newIssueData.title} · ${newIssueData.location}`,
          issueId: issueRef.id
        });
      }

      setForm({
        title: "",
        category: "Internet",
        location: "",
        description: "",
        severity: "Medium",
        people: 10
      });
      setShowForm(false);
    } catch (error) {
      console.error("Could not submit complaint:", error);
      alert("Your complaint could not be submitted. Please try again.");
    }
  }

  // =====================================
  // UPDATE STATUS
  // =====================================

  async function updateStatus(id, status) {
    const existingIssue = issues.find(issue => String(issue.id) === String(id));
    if (!existingIssue || existingIssue.status === status) return;

    try {
      await updateDoc(doc(db, "issues", id), {
        status,
        updatedAt: serverTimestamp()
      });

      if (existingIssue.reportedBy) {
        await createNotification({
          recipientId: existingIssue.reportedBy,
          recipientRole: "student",
          type: "status_update",
          title: "Complaint status updated",
          message: `“${existingIssue.title}” is now ${status}.`,
          issueId: String(existingIssue.id)
        });
      }
    } catch (error) {
      console.error("Could not update complaint status:", error);
      alert("Status update failed. Please try again.");
    }
  }

  // =====================================
  // MAIN JSX
  // =====================================
  if (authLoading) {
    return <div>Loading...</div>;
  }

  if (!authUser) {
    return <Auth />;
  }

  if (issuesLoading) {
    return <div className="app-loading">Loading complaints...</div>;
  }

  // Automatically show the correct dashboard based on the Firestore role.
  if (authRole === "student") {
    return (
      <StudentDashboard
        user={authUser}
        issues={issues.filter(issue => issue.reportedBy === authUser.uid)}
        onLogout={handleLogout}
        onSubmitIssue={async (issueData) => {
          try {
            const issueRef = await addDoc(collection(db, "issues"), {
              ...issueData,
              reportedBy: authUser.uid,
              reporterName: authUser.displayName || authUser.email,
              status: "Pending",
              date: new Date().toISOString().slice(0, 10),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            await createNotification({
              recipientRole: "admin",
              type: "new_complaint",
              title: "New complaint submitted",
              message: `${issueData.title} · ${issueData.location}`,
              issueId: issueRef.id
            });
          } catch (error) {
            console.error("Could not submit student complaint:", error);
            alert("Your complaint could not be submitted. Please try again.");
            throw error;
          }
        }}
      />
    );
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

        <div className="nav-label">
          WORKSPACE
        </div>

        <nav>

          <a
            className="nav-item active"
            href="#dashboard"
            onClick={() => setFilter("All")}
          >
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a
            className="nav-item"
            href="#issues"
            onClick={() => setFilter("All")}
          >
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

          <a
            className="nav-item"
            href="#analytics"
          >
            <BarChart3 size={19} />
            Analytics
          </a>

          <a
            className="nav-item"
            href="#smart-insights"
          >
            <ShieldAlertIcon size={19} />
            Smart Insights
          </a>

        </nav>

        <div className="sidebar-bottom">

          <div className="help-card">

            <div className="help-icon">
              <Activity size={20} />
            </div>

            <strong>CampusPulse</strong>

            <p>
              Making campus life better,
              one solution at a time.
            </p>

          </div>

          <div className="user-profile">
<div className="avatar">
  {authUser?.displayName
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"}
</div>

            <div>
              <strong>{authUser?.displayName || "Campus Admin"}</strong>
              <span>Administrator</span>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content" id="dashboard">

        {/* TOP HEADER */}

        <header className="topbar">

          <div>
            <span className="breadcrumb">
              Workspace / Overview
            </span>

            <h2>Dashboard</h2>
          </div>

          <div className="topbar-actions">

            <NotificationBell user={authUser} role="admin" />

<div className="avatar">
  {authUser?.displayName
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U"}
</div>

          </div>

        </header>

        {/* WELCOME SECTION */}

        <section className="welcome-section">

          <div>
            <h2>
  Good morning, {authUser?.displayName || authUser?.email?.split("@")[0] || "Student"} 👋
</h2>
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

        {/* =================================
            ANALYTICS DASHBOARD
        ================================= */}

        <section className="analytics-section" id="analytics">

          <div className="section-heading analytics-heading">

            <div>
              <h3>
                <BarChart3
                  size={18}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: 7
                  }}
                />
                Campus Analytics
              </h3>

              <p>
                Understand campus issues through data and insights.
              </p>
            </div>

          </div>

          {/* ANALYTICS CARDS */}

          <div className="insights-grid">

            <div className="insight-card">
              <span>Resolution Rate</span>
              <h2>{resolutionRate}%</h2>
              <p>Issues successfully resolved</p>
            </div>

            <div className="insight-card">
              <span>Total Complaints</span>
              <h2>{issues.length}</h2>
              <p>All reported campus issues</p>
            </div>

            <div className="insight-card">
              <span>Most Reported Location</span>

              <h2 className="location-insight">
                {topLocation ? topLocation[0] : "N/A"}
              </h2>

              <p>
                {topLocation
                  ? `${topLocation[1]} reported issue(s)`
                  : "No reports yet"}
              </p>
            </div>

          </div>

          {/* ANALYTICS CHARTS */}

          <div className="charts-grid">

            <div className="chart-card">

              <h3>Issues by Category</h3>

              <p>Distribution of reported complaints</p>

              {categoryData.length > 0 ? (

                <ResponsiveContainer
                  width="100%"
                  height={260}
                >

                  <PieChart>

                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={52}
                      paddingAngle={4}
                    >

                      {categoryData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={
                            CHART_COLORS[
                              index % CHART_COLORS.length
                            ]
                          }
                        />
                      ))}

                    </Pie>

                    <Tooltip />

                  </PieChart>

                </ResponsiveContainer>

              ) : (
                <p>No category data available.</p>
              )}

              <div className="chart-legend">

                {categoryData.map((item, index) => (

                  <span key={item.name}>

                    <i
                      style={{
                        background:
                          CHART_COLORS[
                            index % CHART_COLORS.length
                          ]
                      }}
                    />

                    {item.name} ({item.value})

                  </span>

                ))}

              </div>

            </div>

            <div className="chart-card">

              <h3>Issue Status Overview</h3>

              <p>Current complaint resolution status</p>

              <ResponsiveContainer
                width="100%"
                height={260}
              >

                <BarChart
                  data={statusData}
                  margin={{
                    top: 15,
                    right: 10,
                    left: -15,
                    bottom: 5
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="total"
                    name="Issues"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                    barSize={42}
                  />

                </BarChart>

              </ResponsiveContainer>

            </div>

          </div>

        </section>

        {/* =================================
            SMART CAMPUS INTELLIGENCE
        ================================= */}

        <section
          className="smart-section"
          id="smart-insights"
        >

          <div className="section-heading">

            <div>
              <h3>
                <ShieldAlertIcon
                  size={18}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: 7
                  }}
                />
                Smart Campus Intelligence
              </h3>

              <p>
                Automatically detect campus hotspots and recurring problems.
              </p>
            </div>

          </div>

          {/* SMART SUMMARY CARDS */}

          <div className="smart-summary-grid">

            <div className="smart-summary-card">

              <div className="smart-summary-icon red">
                <MapPin size={20} />
              </div>

              <span>Campus Hotspots</span>

              <h2>{hotspotData.length}</h2>

              <p>Locations with reported complaints</p>

            </div>

            <div className="smart-summary-card">

              <div className="smart-summary-icon orange">
                <Repeat size={20} />
              </div>

              <span>Recurring Patterns</span>

              <h2>{recurringIssues.length}</h2>

              <p>Repeated location-category combinations</p>

            </div>

            <div className="smart-summary-card">

              <div className="smart-summary-icon purple">
                <AlertTriangle size={20} />
              </div>

              <span>High-Risk Locations</span>

              <h2>{riskLocations.length}</h2>

              <p>Locations requiring attention</p>

            </div>

          </div>

          {/* HOTSPOTS AND RECURRING ISSUES */}

          <div className="smart-content-grid">

            {/* CAMPUS HOTSPOTS */}

            <div className="smart-panel">

              <div className="smart-panel-heading">

                <div>
                  <h3>Campus Hotspots</h3>
                  <p>Locations ranked by reported complaints</p>
                </div>

                <MapPin size={19} />

              </div>

              {hotspotData.length > 0 ? (

                <div className="hotspot-list">

                  {hotspotData.slice(0, 5).map((item, index) => (

                    <div
                      className="hotspot-item"
                      key={item.location}
                    >

                      <div className="hotspot-info">

                        <div className="hotspot-rank">
                          {index + 1}
                        </div>

                        <div className="hotspot-details">

                          <strong>{item.location}</strong>

                          <span>
                            {item.count} complaint(s)
                          </span>

                        </div>

                      </div>

                      <div className="hotspot-bar-area">

                        <div className="hotspot-bar">

                          <div
                            className="hotspot-bar-fill"
                            style={{
                              width: `${item.percentage}%`
                            }}
                          />

                        </div>

                        <span>{item.percentage}%</span>

                      </div>

                    </div>

                  ))}

                </div>

              ) : (

                <p className="smart-empty">
                  No campus complaints available yet.
                </p>

              )}

            </div>

            {/* RECURRING ISSUES */}

            <div className="smart-panel">

              <div className="smart-panel-heading">

                <div>
                  <h3>Recurring Issues</h3>
                  <p>Repeated complaints in the same location</p>
                </div>

                <Repeat size={19} />

              </div>

              {recurringIssues.length > 0 ? (

                <div className="recurring-list">

                  {recurringIssues.map(item => (

                    <div
                      className="recurring-item"
                      key={`${item.location}-${item.category}`}
                    >

                      <div className="recurring-icon">
                        <AlertTriangle size={18} />
                      </div>

                      <div className="recurring-details">

                        <strong>{item.category}</strong>

                        <span>{item.location}</span>

                        <small>
                          {item.count} similar reports detected
                        </small>

                      </div>

                      <span className="recurring-count">
                        {item.count}x
                      </span>

                    </div>

                  ))}

                </div>

              ) : (

                <div className="smart-empty">

                  <CheckCircle2 size={25} />

                  <p>
                    No recurring issues detected yet.
                  </p>

                </div>

              )}

            </div>

          </div>

          {/* RISK ALERTS */}

          <div className="risk-panel">

            <div className="smart-panel-heading">

              <div>
                <h3>Campus Risk Alerts</h3>

                <p>
                  Locations that need administrator attention
                </p>
              </div>

              <ShieldAlertIcon size={19} />

            </div>

            {riskLocations.length > 0 ? (

              riskLocations.map(item => (

                <div
                  className="risk-alert"
                  key={item.location}
                >

                  <AlertTriangle size={19} />

                  <div>

                    <strong>{item.location}</strong>

                    <p>
                      {item.urgentCount} unresolved high/critical
                      complaint(s), {item.count} total reports.
                    </p>

                  </div>

                  <span className="risk-label">
                    Attention Required
                  </span>

                </div>

              ))

            ) : (

              <div className="smart-empty">

                <CheckCircle2 size={23} />

                <p>
                  No high-risk locations detected.
                </p>

              </div>

            )}

          </div>

          {/* SMART RECOMMENDATIONS */}

          <div className="recommendation-panel">

            <div className="smart-panel-heading">

              <div>
                <h3>Smart Recommendations</h3>

                <p>
                  Suggested actions based on campus complaint data
                </p>
              </div>

              <LightbulbIcon size={19} />

            </div>

            {recommendations.map((item, index) => (

              <div
                className={`recommendation-item ${item.type}`}
                key={index}
              >

                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>

              </div>

            ))}

          </div>

          {/* AUTOMATIC ESCALATION MONITOR */}
          <div className="risk-panel" style={{ marginTop: "20px" }}>
            <div className="smart-panel-heading">
              <div>
                <h3>Automatic Escalation Monitor</h3>
                <p>
                  Unresolved complaints are flagged when they exceed their severity-based response window.
                </p>
              </div>
              <AlertTriangle size={19} />
            </div>

            {escalatedIssues.length > 0 ? (
              <div className="recurring-list">
                {escalatedIssues.map(issue => {
                  const escalation = getEscalationInfo(issue);

                  return (
                    <div className="recurring-item" key={`escalated-${issue.id}`}>
                      <div className="recurring-icon">
                        <AlertTriangle size={18} />
                      </div>

                      <div className="recurring-details">
                        <strong>{issue.title}</strong>
                        <span>{issue.location} · {issue.severity} priority</span>
                        <small>
                          Open for more than {escalation.responseDays} day(s)
                        </small>
                      </div>

                      <span
                        className="risk-label"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {escalation.overdueDays > 0
                          ? `${escalation.overdueDays}d overdue`
                          : "Escalated"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="smart-empty">
                <CheckCircle2 size={23} />
                <p>No complaints have exceeded their response time.</p>
              </div>
            )}
          </div>

        </section>

        {/* =================================
            ISSUE MANAGEMENT
        ================================= */}

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
                          <CategoryIcon category={issue.category} />
                        </div>

                        <div>

                          <strong>{issue.title}</strong>

                          <span>
                            {issue.category} · {issue.people} people affected
                          </span>

                          {getEscalationInfo(issue).isEscalated && (
                            <small
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                marginTop: "5px",
                                color: "#dc2626",
                                fontWeight: 700
                              }}
                            >
                              <AlertTriangle size={12} />
                              Auto-escalated · {getEscalationInfo(issue).overdueDays} day(s) overdue
                            </small>
                          )}

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

                        <option value="Pending">
                          Pending
                        </option>

                        <option value="In Progress">
                          In Progress
                        </option>

                        <option value="Resolved">
                          Resolved
                        </option>

                      </select>

                    </td>

                  </tr>

                ))}

                {filteredIssues.length === 0 && (

                  <tr>

                    <td
                      colSpan="6"
                      className="empty-state"
                    >
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

        {/* FOOTER */}

        <footer className="footer">
          CampusPulse © 2026 · Built to make campuses better.
        </footer>

      </main>

      {/* =================================
          REPORT ISSUE MODAL
      ================================= */}

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
                  setForm({
                    ...form,
                    title: e.target.value
                  })
                }
              />

              <label>Category</label>

              <select
                value={form.category}
                onChange={e =>
                  setForm({
                    ...form,
                    category: e.target.value
                  })
                }
              >

                {categories.map(category => (

                  <option
                    key={category}
                    value={category}
                  >
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
                  setForm({
                    ...form,
                    location: e.target.value
                  })
                }
              />

              <label>Description</label>

              <textarea
                placeholder="Describe the problem..."
                value={form.description}
                onChange={e =>
                  setForm({
                    ...form,
                    description: e.target.value
                  })
                }
              />

              <div className="form-row">

                <div>

                  <label>Severity</label>

                  <select
                    value={form.severity}
                    onChange={e =>
                      setForm({
                        ...form,
                        severity: e.target.value
                      })
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
                      setForm({
                        ...form,
                        people: e.target.value
                      })
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

// =====================================
// REUSABLE STATISTICS CARD
// =====================================

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


// =====================================
// STUDENT DASHBOARD
// =====================================

function StudentDashboard({ user, issues, onLogout, onSubmitIssue }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Internet");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !location.trim() || !description.trim()) {
      setError("Please complete all fields.");
      return;
    }

    try {
      await onSubmitIssue({
        title: title.trim(),
        category,
        location: location.trim(),
        description: description.trim(),
        severity: "Medium",
        people: 1
      });

      setTitle("");
      setCategory("Internet");
      setLocation("");
      setDescription("");
      setShowForm(false);
    } catch {
      setError("Could not submit your complaint. Please try again.");
    }
  };

  const firstName = user.displayName || user.email?.split("@")[0] || "Student";
  const initials = (user.displayName || user.email || "S")
    .split(/[ @.]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="student-page">
      <header className="student-topbar">
        <div className="student-brand">
          <div className="student-brand-icon"><Activity size={22} /></div>
          <span>Campus<span>Pulse</span></span>
        </div>
        <div className="student-account">
          <NotificationBell user={user} role="student" />
          <div className="avatar">{initials}</div>
          <div className="student-account-info">
            <strong>{firstName}</strong>
            <span>Student</span>
          </div>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="student-main">
        <section className="student-welcome">
          <div>
            <span className="student-eyebrow">STUDENT WORKSPACE</span>
            <h1>Welcome, {firstName} 👋</h1>
            <p>Report campus problems and track the progress of your complaints.</p>
          </div>
          <button className="primary-button" onClick={() => setShowForm(true)}>
            <Plus size={18} /> Report an Issue
          </button>
        </section>

        <section className="student-stats">
          <div className="student-stat-card">
            <span>My Reports</span><strong>{issues.length}</strong>
          </div>
          <div className="student-stat-card">
            <span>Pending</span>
            <strong>{issues.filter(issue => issue.status === "Pending").length}</strong>
          </div>
          <div className="student-stat-card">
            <span>In Progress</span>
            <strong>{issues.filter(issue => issue.status === "In Progress").length}</strong>
          </div>
          <div className="student-stat-card">
            <span>Resolved</span>
            <strong>{issues.filter(issue => issue.status === "Resolved").length}</strong>
          </div>
        </section>

        <section className="student-reports">
          <div className="student-reports-heading">
            <div>
              <h2>My Complaints</h2>
              <p>Track the status of issues you have submitted.</p>
            </div>
          </div>

          {issues.length === 0 ? (
            <div className="student-empty">
              <ClipboardList size={32} />
              <strong>No reports yet</strong>
              <p>Use “Report an Issue” to tell the campus team about a problem.</p>
            </div>
          ) : (
            <div className="student-report-list">
              {issues.slice().sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || new Date(a.date || 0).getTime();
                const bTime = b.createdAt?.toMillis?.() || new Date(b.date || 0).getTime();
                return bTime - aTime;
              }).map(issue => (
                <article className="student-report-card" key={issue.id}>
                  <div className="student-report-icon"><CategoryIcon category={issue.category} /></div>
                  <div className="student-report-content">
                    <strong>{issue.title}</strong>
                    <span>{issue.category} · {issue.location}</span>
                    <p>{issue.description}</p>
                    <small>Reported on {issue.date}</small>
                  </div>
                  <span className={`status ${issue.status.toLowerCase().replace(" ", "-")}`}>
                    {issue.status}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        {showForm && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h3>Report a Campus Issue</h3>
                  <p>Provide details so the campus team can help.</p>
                </div>
                <button className="close-button" onClick={() => setShowForm(false)} type="button">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleStudentSubmit}>
                <label>Issue Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Wi-Fi not working" required />

                <div className="form-row">
                  <div>
                    <label>Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}>
                      {categories.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Location</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Block A" required />
                  </div>
                </div>

                <label>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue..." required />

                {error && <p className="auth-error">{error}</p>}

                <div className="modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="primary-button"><Plus size={17} /> Submit Issue</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


export default App;
