import React, { useState, useRef, useEffect, useCallback, SetStateAction } from 'react';
import ConditionallyRender from 'react-conditionally-render';

import UserChatMessage from '../UserChatMessage/UserChatMessage';
import ChatbotMessage from '../ChatbotMessage/ChatbotMessage';

import {
  botMessage,
  userMessage,
  customMessage,
  createChatMessage,
} from './chatUtils';

import ChatIcon from '../../assets/icons/paper-plane.svg';

import './Chat.css';
import {
  ICustomComponents,
  ICustomMessage,
  ICustomStyles,
} from '../../interfaces/IConfig';
import { IMessage } from '../../interfaces/IMessages';
import { string } from 'prop-types';

interface IChatProps {
  setState: React.Dispatch<SetStateAction<any>>;
  widgetRegistry: any;
  messageParser: any;
  actionProvider: any;
  customComponents: ICustomComponents;
  botName: string;
  customStyles: ICustomStyles;
  headerText: string;
  customMessages: ICustomMessage;
  placeholderText: string;
  validator: (input: string) => Boolean;
  state: any;
  disableScrollToBottom: boolean;
  messageHistory: IMessage[] | string;
  parse?: (message: string) => void;
  actions?: object;
  messageContainerRef: React.MutableRefObject<HTMLDivElement>;
}

const Chat = ({
  state,
  setState,
  widgetRegistry,
  messageParser,
  parse,
  customComponents,
  actionProvider,
  botName,
  customStyles,
  headerText,
  customMessages,
  placeholderText,
  validator,
  disableScrollToBottom,
  messageHistory,
  actions,
  messageContainerRef,
}: IChatProps) => {
  const { messages, isLoading } = state;

  const [input, setInputValue] = useState('');
  const isUserScrolledUpRef = useRef(false);
  const isScrollingRef = useRef(false);

  const isNearBottom = () => {
    if (!messageContainerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
    const threshold = 40; // Small threshold - any scroll up should persist position
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < threshold;
    
    return nearBottom;
  };

  const handleScroll = useCallback(() => {
    if (!messageContainerRef.current) return;
    
    // Immediately set scrolling flag to prevent auto-scroll
    isScrollingRef.current = true;
    
    // Immediate scroll detection without debounce
    const nearBottom = isNearBottom();
    isUserScrolledUpRef.current = !nearBottom;   
 
    // Clear scrolling flag after a short delay
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  const scrollIntoView = () => {
    setTimeout(() => {
      if (messageContainerRef.current) {
        messageContainerRef.current.scrollTop =
          messageContainerRef?.current?.scrollHeight;
      }
    }, 50);
  };

  useEffect(() => {
    if (disableScrollToBottom) return;
    
    // Only auto-scroll if user hasn't manually scrolled up AND not currently scrolling
    if (!isUserScrolledUpRef.current && !isScrollingRef.current) {
      scrollIntoView();
    }
  }, [messages, disableScrollToBottom]);

  // Add scroll event listener to track user scroll position
  useEffect(() => {
    const messageContainer = messageContainerRef.current;
    if (!messageContainer) return;

    messageContainer.addEventListener('scroll', handleScroll);
    
    return () => {
      messageContainer.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const showAvatar = (messages: any[], index: number) => {
    if (index === 0) return true;

    const lastMessage = messages[index - 1];

    if (lastMessage.type === 'bot' && !lastMessage.widget) {
      return false;
    }
    return true;
  };

  const renderMessages = () => {
    return messages.map((messageObject: IMessage, index: number) => {
      if (botMessage(messageObject)) {
        return (
          <React.Fragment key={messageObject.id}>
            {renderChatbotMessage(messageObject, index)}
          </React.Fragment>
        );
      }

      if (userMessage(messageObject)) {
        return (
          <React.Fragment key={messageObject.id}>
            {renderUserMessage(messageObject)}
          </React.Fragment>
        );
      }

      if (customMessage(messageObject, customMessages)) {
        return (
          <React.Fragment key={messageObject.id}>
            {renderCustomMessage(messageObject)}
          </React.Fragment>
        );
      }
    });
  };

  const renderCustomMessage = (messageObject: IMessage) => {
    const customMessage = customMessages[messageObject.type];

    const props = {
      setState,
      state,
      scrollIntoView,
      actionProvider,
      payload: messageObject.payload,
      actions,
    };

    if (messageObject.widget) {
      const widget = widgetRegistry.getWidget(messageObject.widget, {
        ...state,
        scrollIntoView,
        payload: messageObject.payload,
        actions,
      });
      return (
        <>
          {customMessage(props)}
          {widget ? widget : null}
        </>
      );
    }

    return customMessage(props);
  };

  const renderUserMessage = (messageObject: IMessage) => {
    const widget = widgetRegistry.getWidget(messageObject.widget, {
      ...state,
      scrollIntoView,
      payload: messageObject.payload,
      actions,
    });
    return (
      <>
        <UserChatMessage
          message={messageObject.message}
          key={messageObject.id}
          customComponents={customComponents}
        />
        {widget ? widget : null}
      </>
    );
  };

  const renderChatbotMessage = (messageObject: IMessage, index: number) => {
    let withAvatar;
    if (messageObject.withAvatar) {
      withAvatar = messageObject.withAvatar;
    } else {
      withAvatar = showAvatar(messages, index);
    }

    const chatbotMessageProps = {
      ...messageObject,
      setState,
      state,
      customComponents,
      widgetRegistry,
      messages,
      actions,
    };

    if (messageObject.widget) {
      const widget = widgetRegistry.getWidget(chatbotMessageProps.widget, {
        ...state,
        scrollIntoView,
        payload: messageObject.payload,
        actions,
      });
      return (
        <>
          <ChatbotMessage
            customStyles={customStyles.botMessageBox}
            withAvatar={withAvatar}
            {...chatbotMessageProps}
            key={messageObject.id}
          />
          <ConditionallyRender
            condition={!chatbotMessageProps.loading}
            show={widget ? widget : null}
          />
        </>
      );
    }

    return (
      <ChatbotMessage
        customStyles={customStyles.botMessageBox}
        key={messageObject.id}
        withAvatar={withAvatar}
        {...chatbotMessageProps}
        customComponents={customComponents}
        messages={messages}
        setState={setState}
      />
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(isLoading || messages?.find((message: IMessage) => message.loading)) {
      return;
    }

    if (validator && typeof validator === 'function') {
      if (validator(input)) {
        handleValidMessage();
        if (parse) {
          return parse(input);
        }
        messageParser.parse(input);
      }
    } else {
      handleValidMessage();
      if (parse) {
        return parse(input);
      }
      messageParser.parse(input);
    }
  };

  const handleValidMessage = () => {
    setState((state: any) => ({
      ...state,
      messages: [...state.messages, createChatMessage(input, 'user')],
    }));

    // Always scroll to bottom when user sends a message
    scrollIntoView();
    setInputValue('');
  };

  const customButtonStyle = { backgroundColor: '' };
  if (customStyles && customStyles.chatButton) {
    customButtonStyle.backgroundColor = customStyles.chatButton.backgroundColor;
  }

  let header = `Conversation with ${botName}`;
  if (headerText) {
    header = headerText;
  }

  let placeholder = 'Write your message here';
  if (placeholderText) {
    placeholder = placeholderText;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey === false) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="react-chatbot-kit-chat-container">
      <div className="react-chatbot-kit-chat-inner-container">
        <ConditionallyRender
          condition={!!customComponents.header}
          show={
            customComponents.header && customComponents.header(actionProvider)
          }
          elseShow={
            <div className="react-chatbot-kit-chat-header">{header}</div>
          }
        />

        <div
          className="react-chatbot-kit-chat-message-container"
          ref={messageContainerRef}
        >
          <ConditionallyRender
            condition={
              typeof messageHistory === 'string' && Boolean(messageHistory)
            }
            show={
              <div
                dangerouslySetInnerHTML={{ __html: messageHistory as string }}
              />
            }
          />

          {renderMessages()}
          <div style={{ paddingBottom: '15px' }} />
        </div>

        <div className="react-chatbot-kit-chat-input-container">
          <form
            className="react-chatbot-kit-chat-input-form"
            onSubmit={handleSubmit}
          >
            <textarea
              className="react-chatbot-kit-chat-input"
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type='submit'
              className="react-chatbot-kit-chat-btn-send"
              style={customButtonStyle}
            >
              <ChatIcon className="react-chatbot-kit-chat-btn-send-icon" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
