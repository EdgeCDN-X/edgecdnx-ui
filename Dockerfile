FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*
COPY dist/edgecdnx/browser/ /usr/share/nginx/html
COPY build/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
