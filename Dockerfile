FROM ubuntu:18.04
LABEL author=Freelock email=john@freelock.com

RUN export DEBIAN_FRONTEND=noninteractive && \
  apt-get update && apt-get -y install \
    ca-certificates \
    libappindicator1 libasound2 libatk1.0-0 \
    libatk-bridge2.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgcc1 libgconf-2-4 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 \
    gconf-service lsb-release wget xdg-utils \
    fonts-liberation gnupg gnupg2

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst ttf-freefont \
      --no-install-recommends

RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

RUN mkdir -p /opt/visualify
WORKDIR /opt/visualify
ADD index.js visualify* *.mustache package* lib /opt/visualify/
RUN npm install
RUN npm link