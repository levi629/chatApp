import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supanbase"; // make sure the import path is correct
import Navbar from "./navbar";

interface Message {
  chid: number;
  chtext: string;
  chdate: string;
  uid: string;
}

interface User {
  uid: string;
  uname?: string;
}

interface PollIdea {
  qid: number;
  question: string;
}

interface UserVote {
  qid: number;
}

export default function Chat() {
  const { rid } = useParams();
  const [roomName, setRoomName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showPollUI, setShowPollUI] = useState(false);
  const [pollPrompt, setPollPrompt] = useState("");
  const [pollIdeas, setPollIdeas] = useState<PollIdea[]>([]);
  const [currentPollId, setCurrentPollId] = useState<number | null>(null);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [allVotes, setAllVotes] = useState<{ qid: number; count: number }[]>(
    []
  );
  const navigate = useNavigate();

  const AI_BOT_UID = "4f3a9c1e-2b1d-4f9a-6b2c-7d8e9f3b6a1d";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!rid) return;

    const init = async () => {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        navigate("/login");
        return;
      }

      const user = userData.user;

      const { data: roomUsers, error } = await supabase
        .from("t_rooms_users")
        .select("uid")
        .eq("rid", rid)
        .eq("uid", user.id);

      if (error || !roomUsers?.length) {
        alert("Та энэ өрөөнд орох эрхгүй байна.");
        navigate("/");
        return;
      }

      setUserId(user.id);

      const { data: room } = await supabase
        .from("t_rooms")
        .select("rname")
        .eq("rid", rid)
        .single();

      if (room) setRoomName(room.rname);

      fetchRoomUsers();
      fetchMessages();

      const channel = supabase
        .channel(`room_chats_${rid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "t_chats",
            filter: `rid=eq.${rid}`,
          },
          (payload) => {
            const msg = payload.new as Message;
            setMessages((prev) => [...prev, msg]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init();
  }, [rid]);

  // Fetch logged-in user's votes for current poll questions
  useEffect(() => {
    if (!userId || !currentPollId || pollIdeas.length === 0) {
      setUserVotes([]);
      return;
    }

    const fetchVotes = async () => {
      const qids = pollIdeas.map((p) => p.qid);

      const { data, error } = await supabase
        .from("t_answers")
        .select("qid")
        .in("qid", qids)
        .eq("uid", userId);

      if (!error && data) {
        setUserVotes(data);
      } else {
        setUserVotes([]);
      }
    };

    fetchVotes();
  }, [userId, currentPollId, pollIdeas]);

  // Fetch all votes counts per question for current poll
  useEffect(() => {
    if (!currentPollId || pollIdeas.length === 0) {
      setAllVotes([]);
      return;
    }

    const fetchAllVotes = async () => {
      const qids = pollIdeas.map((p) => p.qid);
      const { data: votes, error } = await supabase
        .from("t_answers")
        .select("qid")
        .in("qid", qids);

      if (error || !votes) {
        setAllVotes([]);
        return;
      }

      const counts = qids.map((qid) => ({
        qid,
        count: votes.filter((v) => v.qid === qid).length,
      }));

      setAllVotes(counts);
    };

    fetchAllVotes();
  }, [currentPollId, pollIdeas]);

  async function fetchMessages() {
    if (!rid) return;

    const { data, error } = await supabase
      .from("t_chats")
      .select("*")
      .eq("rid", rid)
      .order("chdate", { ascending: true });

    if (!error && data) setMessages(data);
  }

  async function fetchRoomUsers() {
    if (!rid) return;

    const { data: roomUsers } = await supabase
      .from("t_rooms_users")
      .select("uid")
      .eq("rid", rid);

    const userIds = roomUsers?.map((ru) => ru.uid) || [];

    const { data: usersData } = await supabase
      .from("t_users")
      .select("uid, uname")
      .in("uid", userIds);

    setUsers(usersData || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !userId || !rid) return;

    const { error } = await supabase.from("t_chats").insert([
      {
        chtext: newMessage.trim(),
        chdate: new Date().toISOString(),
        uid: userId,
        rid,
      },
    ]);

    if (!error) setNewMessage("");
  }

  async function askGemini(prompt: string) {
    setAiError(null);
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=AIzaSyBGbgEtONplq47P1ypu30788etWwxNw8hw",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const data = await res.json();
      if (data.error) {
        setAiError(data.error.message);
        return null;
      }

      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err: any) {
      setAiError(err.message);
      return null;
    }
  }

  async function handleGeneratePoll() {
    if (!pollPrompt.trim() || !userId || !rid) return;

    setAiLoading(true);
    const aiResponse = await askGemini(
      pollPrompt + ". 3-5 ideas. Newline each. 255 char max."
    );
    setAiLoading(false);

    if (!aiResponse) return;

    const ideas = aiResponse
      .split("\n")
      .filter(Boolean)
      .map((s) => s.trim());

    // Insert poll
    const { data: poll, error: pollError } = await supabase
      .from("t_b_polls")
      .insert([
        {
          poll: pollPrompt,
          rid,
          uid: userId,
          pdate: new Date().toISOString(),
          hidden: false,
        },
      ])
      .select()
      .single();

    if (pollError || !poll) {
      alert("Failed to create poll");
      return;
    }

    setCurrentPollId(poll.pid);

    // Insert questions
    const { data: insertedQuestions, error: questionError } = await supabase
      .from("t_question")
      .insert(ideas.map((idea) => ({ question: idea, pid: poll.pid })))
      .select();

    if (questionError || !insertedQuestions) {
      alert("Failed to insert poll questions");
      return;
    }

    setPollIdeas(insertedQuestions);

    // Announce new poll in chat
    await supabase.from("t_chats").insert([
      {
        chtext: `📊 Шинэ санал асуулга: ${pollPrompt}`,
        chdate: new Date().toISOString(),
        uid: AI_BOT_UID,
        rid,
      },
    ]);

    setPollPrompt("");
    setShowPollUI(false);
  }

  async function handleVote(qid: number) {
    if (!userId || !currentPollId) return;

    const { error } = await supabase
      .from("t_answers")
      .insert([{ uid: userId, qid }]);

    if (error?.code === "23505") {
      alert("Та аль хэдийнэ санал өгсөн байна.");
    } else if (error) {
      alert("Санал өгөхөд алдаа гарлаа.");
    } else {
      alert("Санал амжилттай өглөө!");
      // Refresh votes after successful vote

      // Fetch user's votes again
      const { data: userData } = await supabase
        .from("t_answers")
        .select("qid")
        .in(
          "qid",
          pollIdeas.map((p) => p.qid)
        )
        .eq("uid", userId);

      setUserVotes(userData || []);

      // Fetch all votes again
      const { data: allVotesData } = await supabase
        .from("t_answers")
        .select("qid")
        .in(
          "qid",
          pollIdeas.map((p) => p.qid)
        );

      if (allVotesData) {
        const counts = pollIdeas.map((p) => ({
          qid: p.qid,
          count: allVotesData.filter((v) => v.qid === p.qid).length,
        }));
        setAllVotes(counts);
      }
    }
  }

  const totalVotes = allVotes.reduce((acc, v) => acc + v.count, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        backgroundColor: "#f4f6fb",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      <Navbar
        roomName={roomName}
        roomId={rid}
        userId={userId}
        onAddUserClick={() => {}}
        onUserClick={() => {}}
        users={users}
      />

      <div
        style={{
          flex: 1,
          padding: "1rem",
          overflowY: "auto",
          backgroundColor: "#433c3b",
        }}
      >
        {messages.map((msg) => {
          const isMine = msg.uid === userId;
          const sender = users.find((u) => u.uid === msg.uid);
          const senderName =
            msg.uid === AI_BOT_UID ? "Gemini AI" : sender?.uname || "Unknown";

          return (
            <div
              key={msg.chid}
              style={{
                alignSelf: isMine ? "flex-end" : "flex-start",
                backgroundColor: isMine ? "#3d5afe" : "#fff",
                color: isMine ? "#fff" : "#333",
                padding: 12,
                borderRadius: 18,
                maxWidth: "70%",
                marginBottom: 12,
              }}
            >
              {!isMine && (
                <strong style={{ fontSize: 13 }}>{senderName}</strong>
              )}
              <div>{msg.chtext}</div>
              <div style={{ fontSize: 11, textAlign: "right" }}>
                {new Date(msg.chdate).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />

        {pollIdeas.length > 0 && (
          <div
            style={{
              backgroundColor: "#2b2b2b",
              padding: "1rem",
              borderRadius: 10,
              marginTop: 10,
            }}
          >
            <strong style={{ color: "#fff" }}>
              Санал асуулгын сонголтууд:
            </strong>
            {pollIdeas.map((idea) => {
              const hasVotedForThis = userVotes.some(
                (vote) => vote.qid === idea.qid
              );
              const votesForThis =
                allVotes.find((v) => v.qid === idea.qid)?.count || 0;
              const percent =
                totalVotes > 0
                  ? ((votesForThis / totalVotes) * 100).toFixed(1)
                  : "0.0";

              return (
                <button
                  key={idea.qid}
                  onClick={() => handleVote(idea.qid)}
                  disabled={hasVotedForThis}
                  style={{
                    display: "block",
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: hasVotedForThis ? "#2e7d32" : "#555",
                    color: "#fff",
                    width: "100%",
                    textAlign: "left",
                    cursor: hasVotedForThis ? "not-allowed" : "pointer",
                    opacity: hasVotedForThis ? 0.6 : 1,
                    position: "relative",
                  }}
                >
                  {hasVotedForThis ? "✔️ " : "✅ "} {idea.question}
                  <span
                    style={{
                      position: "absolute",
                      right: 15,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontWeight: "bold",
                    }}
                  >
                    {votesForThis} vote{votesForThis !== 1 ? "s" : ""} (
                    {percent}%)
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {aiError && (
        <div style={{ color: "red", backgroundColor: "#fff", padding: "8px" }}>
          {aiError}
        </div>
      )}

      <div
        style={{
          padding: "1rem",
          backgroundColor: "#2c2625",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {showPollUI ? (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleGeneratePoll}
                style={{
                  flex: 1,
                  backgroundColor: "#2e7d32",
                  color: "white",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                💡 Generate idea with AI
              </button>
              <button
                onClick={() => setShowPollUI(false)}
                style={{
                  flex: 1,
                  backgroundColor: "#888",
                  color: "white",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                ❌ Cancel
              </button>
            </div>
            <input
              value={pollPrompt}
              onChange={(e) => setPollPrompt(e.target.value)}
              placeholder="Enter poll topic..."
              style={{
                padding: 12,
                borderRadius: 8,
                color: "#fff",
                backgroundColor: "#3a3a3a",
                border: "1px solid #666",
              }}
            />
          </>
        ) : (
          <button
            onClick={() => setShowPollUI(true)}
            style={{
              backgroundColor: "#3d5afe",
              color: "#fff",
              borderRadius: 20,
              padding: 12,
            }}
          >
            ➕ Create Poll
          </button>
        )}{" "}
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Мессеж бичих..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              color: "#ccc",
              backgroundColor: "#444",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={aiLoading}
            style={{
              padding: "12px 20px",
              backgroundColor: "#00bfa5",
              color: "white",
              border: "none",
              borderRadius: "20px",
              fontWeight: 500,
            }}
          >
            {aiLoading ? "AI бичиж байна..." : "Илгээх"}
          </button>
        </div>
      </div>
    </div>
  );
}
