import { useAuth0 } from '@auth0/auth0-react';


function Login() {
  const { user, loginWithRedirect } = useAuth0();

  console.log("Current User:", user);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <header className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <button
          onClick={() => loginWithRedirect()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Login with Redirect
        </button>
      </header>
    </div>
  );
}

export default Login;