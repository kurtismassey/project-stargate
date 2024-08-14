"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { gsap } from "gsap";
import { VT323 } from "next/font/google";
import { db, storage } from "@/firebase/clientApp";
import { getDoc, setDoc, onSnapshot, doc, arrayUnion } from "firebase/firestore";
import { getStorage, ref, uploadString, listAll, getDownloadURL } from "firebase/storage";
import { useUserAuth } from "@/components/AuthContext";
import { v4 as uuidv4 } from "uuid";
import Stage from "@/components/session/Stage";
import ChatWindow from "@/components/session/ChatWindow";
import SignalLine from "@/components/session/SignalLine";
import { debounce } from "lodash";


const vt323 = VT323({ subsets: ["latin"], weight: "400" });
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
const STAGE_MAP = {
  1: "Stage I",
  2: "Stage II",
  3: "Stage III",
  4: "Stage IV",
  5: "Stage V",
};

export default function SessionPage() {
  const { user, loading } = useUserAuth();
  const params = useParams();
  const sessionId = params.sessionId;
  const [currentStage, setCurrentStage] = useState(1);
  const [penColor, setPenColor] = useState("#000000");
  const [mobileUrl, setMobileUrl] = useState("");
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const cursorRef = useRef(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const textareaRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const stageRefs = useRef([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef(null);
  const [lastSavedCanvasData, setLastSavedCanvasData] = useState({});
  const [canvasChanged, setCanvasChanged] = useState(false);
  const websocketReconnectTimeoutRef = useRef(null);
  const [detailsList, setDetailsList] = useState([]);
  const [wsReconnectCount, setWsReconnectCount] = useState(0);
  const [targetImageBase64, setTargetImageBase64] = useState(null);
  const [targetImages, setTargetImages] = useState([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const [actualTargetImage, setActualTargetImage] = useState(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [modelledTargetImage, setModelledTargetImage] = useState(null);

  const handleCompleteSession = () => {
    setIsAnalysing(true);
    console.log("Complete Session Clicked");
    socketRef.current.send(JSON.stringify({
      type: "completeSession",
      sessionId: sessionId
    }));
  };

  useEffect(() => {
    const fetchSessionInfo = async () => {
      const sessionRef = doc(db, "sessions", sessionId);
      const unsubscribe = onSnapshot(sessionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setSessionInfo(data);
          setCurrentStage(data.currentStage || 1);
          if (data.detailsList?.details && data.detailsList?.details?.length > 0) {
            setDetailsList(data.detailsList.details);
          }
          if (data.status === 'completed') {
            setIsSessionComplete(true);
            setCompletionData({
              summary: data.summary,
              details: data.detailsList?.details || [],
              targetImagePath: data.targetImagePath,
              modelledImagePath: data.modelledImagePath,
            });
          }
        }
      });
      return () => unsubscribe();
    };

    fetchSessionInfo();
  }, [sessionId]);

  useEffect(() => {
    if (completionData) {
      const fetchImages = async () => {
        const storage = getStorage();
        
        try {
          if (completionData.targetImagePath) {
            const actualImageRef = ref(storage, completionData.targetImagePath);
            const url = await getDownloadURL(actualImageRef);
            setActualTargetImage(url);
          }
        } catch (error) {
          console.error("Error fetching actual target image:", error);
        }
  
        try {
          if (completionData.modelledImagePath) {
            const modelledImageRef = ref(storage, completionData.modelledImagePath);
            const url = await getDownloadURL(modelledImageRef);
            setModelledTargetImage(url);
          }
        } catch (error) {
          console.error("Error fetching modelled target image:", error);
        }
      };
  
      fetchImages();
    }
  }, [completionData]);  

  const debouncedSetDoc = useMemo(
    () =>
      debounce((sessionId, stageNumber, data) => {
        setDoc(
          doc(db, "sessions", sessionId, "stages", `stage${stageNumber}`),
          data,
        );
      }, 1000),
    [],
  );

  const saveSessionInfoToFirestore = useCallback(async () => {
    try {
      await setDoc(
        doc(db, "sessions", sessionId),
        { currentStage, detailsList, targetImages },
        { merge: true }
      );
      console.log("Session info saved to Firestore");
    } catch (error) {
      console.error("Error saving session info to Firestore:", error);
    }
  }, [sessionId, currentStage, detailsList, targetImages]);

  const saveCanvasToFirestore = useCallback(
    async (stageNumber) => {
      try {
        const stageRef = stageRefs.current[stageNumber - 1];
        if (stageRef && typeof stageRef.getCanvasData === "function") {
          const canvasData = stageRef.getCanvasData();

          if (canvasData !== lastSavedCanvasData[stageNumber]) {
            await setDoc(
              doc(db, "sessions", sessionId, "stages", `stage${stageNumber}`),
              { canvasData },
              { merge: true },
            );
            console.log(`Canvas saved for stage ${stageNumber}`);

            setLastSavedCanvasData((prev) => ({
              ...prev,
              [stageNumber]: canvasData,
            }));
            setCanvasChanged(false);
          }
        }

        await setDoc(
          doc(db, "sessions", sessionId),
          { currentStage: stageNumber },
          { merge: true },
        );
      } catch (error) {
        console.error("Error saving canvas to Firestore:", error);
      }
    },
    [sessionId, lastSavedCanvasData],
  );

  const handleDrawingChange = useCallback(() => {
    setCanvasChanged(true);
  }, []);

  const loadCanvasFromFirestore = useCallback(
    async (stageNumber) => {
      try {
        const docRef = doc(
          db,
          "sessions",
          sessionId,
          "stages",
          `stage${stageNumber}`,
        );
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().canvasData) {
          const stageRef = stageRefs.current[stageNumber - 1];
          if (stageRef && stageRef.loadCanvasData) {
            stageRef.loadCanvasData(docSnap.data().canvasData);
            console.log(`Canvas loaded for stage ${stageNumber}`);
          }
        }
      } catch (error) {
        console.error("Error loading canvas from Firestore:", error);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    loadCanvasFromFirestore(currentStage);
  }, [currentStage, loadCanvasFromFirestore]);

  useEffect(() => {
    gsap.to(cursorRef.current, {
      opacity: 0,
      repeat: -1,
      yoyo: true,
      duration: 0.7,
    });
  }, []);

  const drawReceivedStroke = useCallback(
    (data) => {
      const stageRef = stageRefs.current[data.stageNumber - 1];
      if (stageRef && typeof stageRef.drawReceivedStroke === "function") {
        stageRef.drawReceivedStroke(data);
        handleDrawingChange();
      }
    },
    [handleDrawingChange],
  );

  const clearReceivedCanvas = useCallback(
    (stageNumber) => {
      const stageRef = stageRefs.current[stageNumber - 1];
      if (stageRef && typeof stageRef.clearCanvas === "function") {
        stageRef.clearCanvas();
        handleDrawingChange();
      }
    },
    [handleDrawingChange],
  );

  const saveTargetImageToStorage = async (imageBase64) => {
    const imageRef = ref(storage, `sessions/${sessionId}/targetImage/${Date.now()}.jpg`);
    try {
      await uploadString(imageRef, imageBase64, 'base64', { contentType: 'image/jpeg' });
      console.log("Target image saved to Firebase Storage");
    } catch (error) {
      console.error("Error saving target image to Firebase Storage:", error);
    }
  };

  const handleGeminiStreamResponse = (response) => {
    setMessages((prevMessages) => {
      const existingMessageIndex = prevMessages.findIndex(
        (msg) => msg.id === response.id
      );

      if (existingMessageIndex !== -1) {
        const updatedMessages = [...prevMessages];
        updatedMessages[existingMessageIndex] = {
          ...updatedMessages[existingMessageIndex],
          text: response.text,
          timestamp: response.timestamp,
        };
        return updatedMessages;
      } else {
        return [
          ...prevMessages,
          {
            id: response.id,
            user: response.user,
            text: response.text,
            timestamp: response.timestamp,
          },
        ];
      }
    });
  };

  const submitMessage = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const newMessage = {
        id: uuidv4(),
        user: "Viewer",
        text: inputValue.trim(),
        timestamp: new Date().toISOString()
      };

      if (inputValue.trim() !== "") {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      }

      const currentStageRef = stageRefs.current[currentStage - 1];
      const canvasData = currentStageRef.getCanvasURL();

      socketRef.current.send(
        JSON.stringify({
          type: "sketchAndChat",
          id: newMessage.id,
          user: newMessage.user,
          message: newMessage.text,
          sessionId,
          stageNumber: currentStage,
          sketch: canvasData,
        }),
      );

      setInputValue("");
    } else {
      console.error("WebSocket is not connected. Message not sent.");
    }
  }, [inputValue, sessionId, currentStage]);

  useEffect(() => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const mobileUrl = `${protocol}//${host}/session/${sessionId}/mobile`;
    setMobileUrl(mobileUrl);
  }, [sessionId]);

  useEffect(() => {
    let saveInterval = setInterval(() => {
      if (canvasChanged) {
        saveCanvasToFirestore(currentStage);
      }
    }, 5000);
  
    return () => clearInterval(saveInterval);
  }, [currentStage, saveCanvasToFirestore, canvasChanged]);

  const updateDetailsList = useCallback((newDetails) => {
    setDetailsList((prevDetails) => {
      const detailsSet = new Set(prevDetails);
      newDetails.forEach((detail) => detailsSet.add(detail));
      return Array.from(detailsSet);
    });
  }, []);  

  const connectWebSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket is already connected.");
      return;
    }
  
    const ws = new WebSocket(WEBSOCKET_URL);
    socketRef.current = ws;
  
    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
      ws.send(JSON.stringify({ type: "joinSession", sessionId }));
      setWsReconnectCount(0);
    };
  
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "initialHistory":
          setMessages(data.history);
          setCurrentStage(data.currentStage);
          if (data.status === 'completed') {
            setIsSessionComplete(true);
            setCompletionData(data.completionData);
          } else {
            setTargetImageBase64(data.latestTargetImage);
          }
          break;
        case "draw":
          drawReceivedStroke(data);
          saveCanvasToFirestore(
            data.stageNumber,
            stageRefs.current[data.stageNumber - 1]?.getCanvasData(),
          );
          break;
        case "clear":
          clearReceivedCanvas(data.stageNumber);
          break;
        case "syncStage":
          setCurrentStage(data.stageNumber);
          break;
        case "updateDetails":
          console.log("Received updateDetails:", data.details);
          updateDetailsList(data.details.details);
          break;
        case "geminiStreamResponse":
          handleGeminiStreamResponse(data);
          break;
        case "geminiError":
          console.error("Gemini Error:", data.message);
          break;
        case "updateTargetImage":
          setTargetImageBase64(data.imageBase64);
          saveTargetImageToStorage(data.imageBase64);
          break;
        case "sessionCompleted":
          setIsSessionComplete(true);
          setCompletionData({
            targetImagePath: data.targetImagePath,
            modelledImagePath: data.modelledImagePath,
            summary: data.summary,
            details: data.details,
          });
          setIsAnalysing(false);
          break;
      }
    };
  
    ws.onclose = (event) => {
      console.log("WebSocket disconnected", event);
      setWsConnected(false);
      const reconnectDelay = Math.min(1000 * (2 ** wsReconnectCount), 30000);
      websocketReconnectTimeoutRef.current = setTimeout(() => {
        setWsReconnectCount(count => count + 1);
        connectWebSocket();
      }, reconnectDelay);
    };
  
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      ws.close();
    };
  }, [
    sessionId,
    drawReceivedStroke,
    clearReceivedCanvas,
    saveCanvasToFirestore,
    updateDetailsList,
    wsReconnectCount,
  ]);
  

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (websocketReconnectTimeoutRef.current) {
        clearTimeout(websocketReconnectTimeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  function handleStageChange(stageNumber) {
    setCurrentStage(stageNumber);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "syncStage",
          sessionId: sessionId,
          stageNumber: stageNumber,
        }),
      );
    } else {
      console.warn("WebSocket is not open. Stage change not synced.");
    }
  }

  const handleSetIsDrawing = (drawingState) => {
    setIsDrawing(drawingState);
  };

  useEffect(() => {
    if (detailsList.length > 0 || targetImages.length > 0) {
      saveSessionInfoToFirestore();
    }
  }, [detailsList, targetImages, saveSessionInfoToFirestore]);
  

  if (isAnalysing) {
    return (
      <div className={`w-screen h-screen flex flex-col justify-center items-center bg-black text-green-500 ${vt323.className} p-8`}>
        <h2 className="text-3xl mb-4 glow">Analysing Remote Viewing Session</h2>
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-green-500 glow"></div>
      </div>
    );
  }

  if (isSessionComplete && completionData) {
    return (
      <div className={`flex flex-col justify-center items-center bg-black text-green-500 ${vt323.className} p-8`}>
        <h2 className="text-4xl mb-6 text-center glow">SESSION SUMMARY</h2>
        
        <div className="flex justify-center space-x-[250px] mb-8">
          <div className="flex flex-col items-center">
            <h3 className="text-2xl mb-2">Modelled Target</h3>
            {modelledTargetImage ? (
              <img
                src={modelledTargetImage}
                alt="Modelled Target"
                className="border-2 border-green-500 max-w-[300px] max-h-[300px] object-contain"
              />
            ) : (
              <div className="border-2 border-green-500 w-[300px] h-[300px] flex items-center justify-center">
                <p>Loading modelled target image...</p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center">
            <h3 className="text-2xl mb-2">Actual Target</h3>
            {actualTargetImage ? (
              <img
                src={actualTargetImage}
                alt="Actual Target"
                className="border-2 border-green-500 max-w-[300px] max-h-[300px] object-contain"
              />
            ) : (
              <div className="border-2 border-green-500 w-[300px] h-[300px] flex items-center justify-center">
                <p>Loading actual target image...</p>
              </div>
            )}
          </div>
        </div>
      
        <div className="grid mt-10 grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-4xl">
          <div>
            <h3 className="text-2xl mb-4 glow">Identified Details:</h3>
            {completionData.details && completionData.details.length > 0 ? (
              <ul className="list-disc list-inside">
                {completionData.details.map((detail, index) => (
                  <li key={index} className="mb-2">{detail}</li>
                ))}
              </ul>
            ) : (
              <p>No details identified</p>
            )}
          </div>
          <div>
            <h3 className="text-2xl mb-4 glow">Session Summary:</h3>
            <p className="border border-green-500 p-4 bg-green-900 bg-opacity-20">
              {completionData.summary || "No summary available"}
            </p>
          </div>
        </div>
      
        <footer className="fixed w-full bottom-0 justify-center items-center p-10 mt-8 text-center text-sm">
          <div className="mt-8 text-center">
            <Link href="/" className="text-blue-400 hover:text-blue-600 glow text-xl">
              RETURN TO COMMAND CENTER
            </Link>
          </div>
          <p>
            <span className="glow">
              <span className="line-through">SECRET</span>: PROJECT STARGATE
            </span>{" "}
            - <span className="font-bold">WEB</span> -{" "}
            <span className="glow">AUTHORIZED PERSONNEL ONLY</span>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen bg-opacity-50 text-green-500 ${vt323.className}`}
    >
      <div className="flex justify-center mt-5 space-x-2 mx-[150px] z-50">
        {[1, 2, 3, 4, 5].map((stageNumber) => (
          <button
            key={stageNumber}
            onClick={() => handleStageChange(stageNumber)}
            className={`px-4 py-2 rounded border ${
              currentStage === stageNumber ? "border-white" : "border-[#004B88]"
            }`}
          >
            {STAGE_MAP[stageNumber]}
          </button>
        ))}
        <button
            onClick={handleCompleteSession}
            className="px-4 py-2 rounded border border-white uppercase"
            style={{ backgroundColor: "#ed1c23", color: "white"}}
            >
            Complete Session
        </button>
      </div>

      <main className="flex-grow flex p-4 space-x-4 mt-5">
        <div className="flex-1 flex flex-col">
          {[1, 2, 3, 4, 5].map((stageNumber) => (
            <Stage
              key={stageNumber}
              ref={(el) => (stageRefs.current[stageNumber - 1] = el)}
              stageNumber={stageNumber}
              currentStage={currentStage}
              clearCanvas={clearReceivedCanvas}
              penColor={penColor}
              setPenColor={setPenColor}
              sessionInfo={sessionInfo}
              isDrawing={isDrawing}
              setIsDrawing={handleSetIsDrawing}
              lastPointRef={lastPointRef}
              socketRef={socketRef}
              sessionId={sessionId}
              debouncedSetDoc={debouncedSetDoc}
              wsConnected={wsConnected}
              mobileUrl={mobileUrl}
              onDrawingChange={handleDrawingChange}
              saveCanvasToFirestore={saveCanvasToFirestore}
            />
          ))}
        </div>
        <div className="w-[350px] flex-col">
          <ChatWindow
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            submitMessage={submitMessage}
            textareaRef={textareaRef}
            cursorRef={cursorRef}
            handleKeyDown={handleKeyDown}
          />
        </div>
        <div className="w-[350px] flex-col text-center">
          <h3 className="mb-3">Intelligence Analysis</h3>
          <div className="mb-3 p-3 h-[150px] border border-outline border-white rounded items-center text-center">
            <p>
              <span style={{ color: "#0d76bd" }}>
                [<span style={{ color: "#ed1c23" }}>SIGNAL-LINE</span>]
              </span>
            </p>
            <div className="m-2 py-5">
              <SignalLine
                width={300}
                height={50}
                lineColor="#ed1c23"
                jitterAmplitude={5}
                baseLinePosition={0.5}
                secondLineColor="#FFFFFF"
                secondLineAmplitude={20}
                secondLineFrequency={(Math.random() * 16 / 95)}
                secondLineBasePosition={0.5}
              />
            </div>
          </div>
          <div className="mb-3 p-3 h-[190px] border border-outline border-white rounded overflow-y-auto">
              <p className="mb-1 text-center">Key Details</p>
              <div className="flex flex-wrap justify-center items-center justify-between">
                {detailsList && detailsList.length > 0 ? (
                  detailsList.map((detail, index) => (
                    <span
                      key={index}
                      className="border border-outline border-white rounded my-0.5 mx-0.5 py-1 px-2 flex-grow text-xs"
                      style={{ backgroundColor: "white", color: "black" }}
                    >
                      {detail}
                    </span>
                  ))
                ) : (
                  <span>No details identified</span>
                )}
              </div>
            </div>
            <div className="mb-3 p-3 h-[365px] border border-outline border-white rounded items-center text-center">
            <p className="pt-1">Target Modelling</p>
            <div className="flex m-2 p-2 bg-slate-700 space-x-2 mt-5 h-[280px] rounded items-center justify-center" style={{ backgroundColor: "#242526" }}>
              {targetImageBase64 ? (
                <img 
                  src={`data:image/jpeg;base64,${targetImageBase64}`} 
                  alt="Target Model" 
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <p className="animate-pulse">
                  Provide more data on the target to generate a potential fit...
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-green-900 bg-opacity-20 p-4 text-center border-t-2 border-green-500">
        <Link href="/" className="text-blue-400 hover:text-blue-600 glow">
          RETURN TO COMMAND CENTER
        </Link>
        <p className="mt-2 text-sm">
          <span className="glow">
            <span className="line-through">SECRET</span>: PROJECT STARGATE
          </span>{" "}
          - <span className="font-bold">WEB</span> -{" "}
          <span className="glow">AUTHORIZED PERSONNEL ONLY</span>
        </p>
      </footer>
    </div>
  );
}