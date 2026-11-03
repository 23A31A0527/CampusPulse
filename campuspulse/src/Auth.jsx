import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function Auth() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(result.user, { displayName: cleanName });

        // Every new signup receives a student profile at users/{uid}.
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          name: cleanName,
          email: cleanEmail,
          role: "student",
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      }
      // App.jsx handles routing through onAuthStateChanged.
    } catch (err) {
      console.error("Authentication failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>CampusPulse</h1>
        <p>{isSignup ? "Create your student account" : "Student Login"}</p>

        {isSignup && (
          <input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          type="email"
          placeholder="College Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password (minimum 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignup ? "Sign Up" : "Login"}
        </button>

        <p>
          {isSignup ? "Already registered?" : "New student?"}
          <span
            onClick={() => {
              setIsSignup(!isSignup);
              setError("");
            }}
            style={{ cursor: "pointer", color: "#6366f1", marginLeft: 6 }}
          >
            {isSignup ? "Login" : "Create Account"}
          </span>
        </p>
      </form>
    </div>
  );
}
