import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

export default function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      let result;

      if (isSignup) {
        result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await updateProfile(result.user, {
          displayName: name,
        });
      } else {
        result = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      onLogin(result.user);
    } catch (err) {
      setError(err.message);
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

        <button type="submit">
          {isSignup ? "Sign Up" : "Login"}
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