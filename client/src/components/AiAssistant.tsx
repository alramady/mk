import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Streamdown } from "streamdown";
import {
  Bot, X, Send, Plus, Trash2, MessageCircle,
  Star, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function AiAssistant() {
  const { t, lang, dir } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const conversationsQuery = trpc.ai.conversations.useQuery(undefined, {
    enabled: isAuthenticated && isOpen,
  });

  const messagesQuery = trpc.ai.messages.useQuery(
    { conversationId: activeConversationId! },
    { enabled: !!activeConversationId },
  );

  // Mutations
  const newConversation = trpc.ai.newConversation.useMutation({
    onSuccess: (data) => {
      setActiveConversationId(data.id);
      setShowHistory(false);
      conversationsQuery.refetch();
    },
  });

  const deleteConversation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      if (activeConversationId) {
        setActiveConversationId(null);
      }
      conversationsQuery.refetch();
    },
  });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast.error(t("ai.error"));
    },
  });

  const rateMutation = trpc.ai.rateMessage.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
      toast.success(t("ai.rated"));
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data, isTyping]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConversationId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeConversationId]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    let convId = activeConversationId;
    if (!convId) {
      const result = await newConversation.mutateAsync({
        title: input.substring(0, 50),
      });
      convId = result.id;
    }

    if (!convId) return;

    const msg = input.trim();
    setInput("");
    setIsTyping(true);

    chatMutation.mutate({
      conversationId: convId,
      message: msg,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setShowHistory(false);
    setInput("");
  };

  const handleStartNewConversation = async () => {
    const result = await newConversation.mutateAsync({});
    setActiveConversationId(result.id);
    setShowHistory(false);
  };

  if (!isAuthenticated) return null;

  const BackIcon = dir === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow"
            style={{ [dir === "rtl" ? "left" : "right"]: "1.5rem" }}
          >
            <Bot className="w-7 h-7" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-2rem)]"
            style={{ [dir === "rtl" ? "left" : "right"]: "1rem" }}
          >
            <Card className="flex flex-col h-full overflow-hidden shadow-2xl border-emerald-200/50">
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 flex items-center gap-3">
                {(showHistory || activeConversationId) && (
                  <button
                    onClick={() => {
                      if (showHistory) setShowHistory(false);
                      else handleNewChat();
                    }}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <BackIcon className="w-5 h-5" />
                  </button>
                )}
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{t("ai.title")}</h3>
                    <p className="text-xs text-emerald-100">{t("ai.subtitle")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title={t("ai.history")}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNewChat}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title={t("ai.newChat")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {showHistory ? (
                  /* History Panel */
                  <ScrollArea className="h-full">
                    <div className="p-3 space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={handleStartNewConversation}
                      >
                        <Plus className="w-4 h-4" />
                        {t("ai.newChat")}
                      </Button>
                      <Separator />
                      {conversationsQuery.data?.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {t("ai.noHistory")}
                        </p>
                      )}
                      {conversationsQuery.data?.map((conv) => (
                        <div
                          key={conv.id}
                          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                            activeConversationId === conv.id
                              ? "bg-emerald-50 border border-emerald-200"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setActiveConversationId(conv.id);
                            setShowHistory(false);
                          }}
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {conv.title || t("ai.newChat")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(conv.updatedAt).toLocaleDateString(
                                lang === "ar" ? "ar-SA" : "en-US"
                              )}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation.mutate({ id: conv.id });
                            }}
                            className="p-1 hover:bg-red-100 rounded text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : !activeConversationId ? (
                  /* Welcome Screen */
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                      <Bot className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{t("ai.title")}</h3>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      {t("ai.welcome")}
                    </p>
                    <div className="space-y-2 w-full max-w-[280px]">
                      {[
                        lang === "ar" ? "كيف أبحث عن شقة في الرياض؟" : "How to search for an apartment in Riyadh?",
                        lang === "ar" ? "كيف أضيف عقاري للمنصة؟" : "How to list my property?",
                        lang === "ar" ? "وش خطوات الحجز؟" : "What are the booking steps?",
                        lang === "ar" ? "كيف أرسل طلب صيانة؟" : "How to submit a maintenance request?",
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={async () => {
                            const result = await newConversation.mutateAsync({
                              title: suggestion.substring(0, 50),
                            });
                            if (!result.id) return;
                            setActiveConversationId(result.id);
                            setInput("");
                            setIsTyping(true);
                            chatMutation.mutate({
                              conversationId: result.id!,
                              message: suggestion,
                            });
                          }}
                          className="w-full text-start p-3 rounded-lg border border-border hover:bg-emerald-50 hover:border-emerald-200 text-sm transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Messages */
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {messagesQuery.data?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                              msg.role === "user"
                                ? "bg-emerald-600 text-white rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            }`}
                            style={
                              msg.role === "user" && dir === "rtl"
                                ? { borderBottomLeftRadius: "0.125rem", borderBottomRightRadius: "1rem" }
                                : {}
                            }
                          >
                            {msg.role === "assistant" ? (
                              <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                <Streamdown>{msg.content}</Streamdown>
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            )}
                            {msg.role === "assistant" && (
                              <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/30">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() =>
                                      rateMutation.mutate({
                                        messageId: msg.id,
                                        rating: star,
                                      })
                                    }
                                    className="p-0.5 transition-colors"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        msg.rating && star <= msg.rating
                                          ? "fill-amber-400 text-amber-400"
                                          : "text-muted-foreground/40 hover:text-amber-400"
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("ai.thinking")}
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Input */}
              {(activeConversationId || !showHistory) && !showHistory && activeConversationId && (
                <div className="p-3 border-t bg-background">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t("ai.placeholder")}
                      rows={1}
                      className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent max-h-24"
                      style={{ direction: dir }}
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!input.trim() || isTyping}
                      className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10 w-10 shrink-0"
                    >
                      <Send className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
