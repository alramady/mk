import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageSquare, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Messages() {
  const { t, lang, dir } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/messages/:id");
  const [selectedConv, setSelectedConv] = useState<number | null>(params?.id ? Number(params.id) : null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const conversations = trpc.message.getConversations.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 10000 });
  const messages = trpc.message.getMessages.useQuery(
    { conversationId: selectedConv!, limit: 100 },
    { enabled: isAuthenticated && !!selectedConv, refetchInterval: 5000 }
  );

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      setMessageText("");
      utils.message.getMessages.invalidate({ conversationId: selectedConv! });
      utils.message.getConversations.invalidate();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  // Handle URL params for starting new conversation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const toUser = urlParams.get("to");
    const propertyId = urlParams.get("property");
    if (toUser && isAuthenticated) {
      // Start or find conversation
      const startConv = trpc.message.startConversation.useMutation;
    }
  }, [isAuthenticated]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const handleSend = () => {
    if (!messageText.trim() || !selectedConv) return;
    sendMessage.mutate({ conversationId: selectedConv, content: messageText.trim() });
  };

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container py-4 flex-1 flex flex-col">
        <div className="flex-1 flex gap-4 min-h-0" style={{ height: "calc(100vh - 8rem)" }}>
          {/* Conversation List */}
          <div className={`w-full md:w-80 shrink-0 flex flex-col ${selectedConv ? "hidden md:flex" : "flex"}`}>
            <h2 className="text-lg font-heading font-semibold mb-3">{t("messages.title")}</h2>
            <ScrollArea className="flex-1">
              {conversations.isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : conversations.data && conversations.data.length > 0 ? (
                <div className="space-y-1">
                  {conversations.data.map((conv) => {
                    const isSelected = selectedConv === conv.id;
                    const otherName = conv.tenantId === user?.id ? `${lang === "ar" ? "المالك" : "Landlord"} #${conv.landlordId}` : `${lang === "ar" ? "المستأجر" : "Tenant"} #${conv.tenantId}`;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConv(conv.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary"}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {otherName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{otherName}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {lang === "ar" ? "لا توجد رسائل" : "No messages"}
                            </div>
                          </div>
                          {conv.lastMessageAt && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(conv.lastMessageAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-sm">{t("messages.noConversations")}</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col border rounded-xl overflow-hidden ${!selectedConv ? "hidden md:flex" : "flex"}`}>
            {selectedConv ? (
              <>
                {/* Chat header */}
                <div className="p-3 border-b bg-card flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedConv(null)}>
                    <BackArrow className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">C</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">
                    {lang === "ar" ? `محادثة #${selectedConv}` : `Conversation #${selectedConv}`}
                  </span>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messages.isLoading ? (
                    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-48" />)}</div>
                  ) : messages.data && messages.data.length > 0 ? (
                    <div className="space-y-3">
                      {messages.data.map((msg) => {
                        const isMine = msg.senderId === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                              isMine ? "bg-primary text-primary-foreground rounded-ee-sm" : "bg-secondary rounded-es-sm"
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <span className={`text-[10px] mt-1 block ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground text-sm">{lang === "ar" ? "ابدأ المحادثة" : "Start the conversation"}</p>
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-3 border-t bg-card">
                  <div className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      placeholder={t("messages.typeMessage")}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                      className="flex-1"
                    />
                    <Button onClick={handleSend} disabled={!messageText.trim() || sendMessage.isPending} size="icon" className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">{lang === "ar" ? "اختر محادثة للبدء" : "Select a conversation to start"}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
