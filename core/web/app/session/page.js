import Link from "next/link";

export default function NoSessionId() {
  return (
    <div className="w-screen h-screen flex justify-center align-center justify-center">
      <div className="flex flex-col space-y-10 text-center justify-center">
        <h1 style={{ color: "#0d76bd" }}>
          [<span style={{ color: "#ed1c23" }}>NO SESSION TARGET HERE</span>]
        </h1>
        <Link
          href="/"
          className="outline px-10 py-5 outline-white rounded-full text-white hover:bg-white hover:text-black"
        >
          Return to Base
        </Link>
      </div>
    </div>
  );
}
